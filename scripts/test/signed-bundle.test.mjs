// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The signing rail: proves a REAL bundled build produces artifacts that verify, not that the signing
// helper works in isolation. A unit test over a signing helper cannot catch the failure this rail
// exists for: the app's own installer checks a detached signature over the EXACT manifest.json bytes
// inside the .b3 and the exact index.json bytes on disk, so anything that re-serializes, re-frames, or
// forgets to sign one of the two produces a build that looks green and installs as untrusted (or, once
// the org key is the anchor, is refused outright). This runs the actual buildBundle under a throwaway
// key and reads the proof back out of the artifacts it wrote.
//
// What it proves is that the SIGNATURES verify over the bytes the build wrote, which is one of the
// installer's conditions and not all of them: the installer additionally requires the signing key to
// match a pinned anchor and refuses a signed package whose manifest enumerates no files. Those two are
// the app's own tests to make; this rail is about the bytes the build produces.
//
// The key is generated per run and discarded with the process: the org's private key is never in this
// repo and never in a test. openpgp and the signing primitives are imported from the sibling b3-builder
// checkout, which this rail already requires (the golden rail builds it before it runs).
//
// Run with: node --test scripts/test/signed-bundle.test.mjs

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildBundle } from '../app-bundle.mjs'
import { SIGNING_KEY_VAR } from '../bundle-signing.mjs'
import { APP_REPO_DIR, builderCore, builderDependency, ensureBuilderBuilt, makeScratchOutputDir } from './builder-checkout.mjs'

// One build serves every assertion below: a bundled build packs two dozen plugins and takes seconds,
// and every claim here is about the same set of artifacts.
async function buildSignedBundle(openpgp, reusedOutputDir = null) {
  const generated = await openpgp.generateKey({
    userIDs: [{ name: 'Throwaway Bundle Signer', email: 'signer@example.invalid' }],
    format: 'object',
  })
  const outputDir = reusedOutputDir ?? makeScratchOutputDir('signed-bundle-')
  const previousKey = process.env[SIGNING_KEY_VAR]
  process.env[SIGNING_KEY_VAR] = generated.privateKey.armor()
  try {
    const built = await buildBundle({ sourceRoot: APP_REPO_DIR, outputDir, channel: 'dev' })

    return { ...built, outputDir, publicKey: generated.publicKey.armor() }
  } finally {
    if (previousKey === undefined) delete process.env[SIGNING_KEY_VAR]
    else process.env[SIGNING_KEY_VAR] = previousKey
  }
}

test('a signed bundled build produces packages and an index that verify', { timeout: 300_000 }, async (rail) => {
  ensureBuilderBuilt()
  const openpgp = builderDependency('openpgp')
  const AdmZip = builderDependency('adm-zip')
  const core = await builderCore()
  const bundle = await buildSignedBundle(openpgp)

  await rail.test('every packed .b3 carries exactly one signature over its own manifest bytes', async () => {
    assert.ok(bundle.packages.length > 0, 'a bundled build that packed nothing proves nothing about signing')
    await Promise.all(bundle.packages.map(async (packed) => {
      const archive = new AdmZip(packed.path)
      const signatures = archive.getEntries().filter((member) => member.entryName === 'manifest.json.sig')
      assert.equal(signatures.length, 1, `${packed.filename}: expected exactly one manifest.json.sig`)
      const manifestEntry = archive.getEntry('manifest.json')
      const verified = await core.verifyDetached(
        manifestEntry.getData(),
        signatures[0].getData().toString('utf8'),
        bundle.publicKey,
      )
      assert.equal(verified, true, `${packed.filename}: manifest signature does not verify`)
    }))
  })

  // The app verifies the bytes it RECEIVED, never a re-serialization of the parsed index, so the
  // signature has to check out against index.json exactly as it sits on disk.
  await rail.test('index.json.sig verifies over the exact bytes written beside it', async () => {
    assert.equal(bundle.signed, true, 'a build with a signing key must report itself signed')
    const indexBytes = readFileSync(join(bundle.outputDir, 'index.json'))
    const signature = readFileSync(join(bundle.outputDir, 'index.json.sig'), 'utf8')
    assert.equal(await core.verifyDetached(indexBytes, signature, bundle.publicKey), true)
  })

  // The index's publisher is the identity a client matches the signatures against, so it has to name
  // the key that actually signed this build. Advertising any other identity ships packages whose
  // signature contradicts their publisher, which the app reads as tampering and REFUSES outright.
  await rail.test('the index advertises the fingerprint of the key that signed', async () => {
    assert.equal(bundle.index.publisher, await core.publicKeyFingerprint(bundle.publicKey))
  })

  // The publisher inside a packed .b3 is what the installed package itself claims, and a plugin source
  // manifest cannot know it (it ships PLACEHOLDER until a build signs it). If the package claimed one
  // identity while its signature came from another key, the app would read the pair as tampering, so
  // the packed manifest, the catalog entry, and the index header all have to name the signing key.
  await rail.test('every packed manifest names the signing key as its publisher', async () => {
    const signerFingerprint = await core.publicKeyFingerprint(bundle.publicKey)
    bundle.packages.forEach((packed) => {
      const manifest = JSON.parse(new AdmZip(packed.path).getEntry('manifest.json').getData().toString('utf8'))
      assert.equal(manifest.publisher, signerFingerprint, `${packed.filename}: packed manifest names a foreign publisher`)
    })
    const entryPublishers = [...bundle.index.plugins, ...bundle.index.collections].map((entry) => entry.publisher)
    assert.deepEqual([...new Set(entryPublishers)], [signerFingerprint])
  })

  // Skip-unchanged decides whether the ARCHIVE was rebuilt, which says nothing about whether it is
  // already signed, so a rebuild over the same output dir re-signs .b3 files it did not repack. That
  // must REPLACE the signature: an archive carrying two signatures that disagree, or a stale one from a
  // rotated key, is refused at install rather than merely untrusted. Rebuilding under a second key is
  // what makes the replacement visible, since only a replaced signature verifies against the new one.
  await rail.test('a rebuild under a rotated key replaces each signature rather than adding one', async () => {
    const rebuilt = await buildSignedBundle(openpgp, bundle.outputDir)
    assert.equal(rebuilt.packages.length, bundle.packages.length, 'a rebuild that packed nothing proves nothing')
    await Promise.all(rebuilt.packages.map(async (packed) => {
      const archive = new AdmZip(packed.path)
      const signatures = archive.getEntries().filter((member) => member.entryName === 'manifest.json.sig')
      assert.equal(signatures.length, 1, `${packed.filename}: rebuild left ${signatures.length} signatures`)
      const verified = await core.verifyDetached(
        archive.getEntry('manifest.json').getData(),
        signatures[0].getData().toString('utf8'),
        rebuilt.publicKey,
      )
      assert.equal(verified, true, `${packed.filename}: signature still belongs to the superseded key`)
    }))
  })
})

// NO-DOWNGRADE, at the build end of the same policy the installer implements: a build with no key is a
// legitimate state (it installs at trust tier 'unknown'), but it must not leave a signature from an
// earlier signed build sitting beside a freshly written index. That stale pair reads to the app as
// tampering, which is a hard refusal rather than a missing badge. The same holds one level down: a .b3
// the rebuild did not repack still carries the previous run's manifest signature, and that signature has
// to be peeled rather than served.
test('an unsigned build removes the stale signatures instead of leaving them', { timeout: 300_000 }, async () => {
  ensureBuilderBuilt()
  const AdmZip = builderDependency('adm-zip')
  const signed = await buildSignedBundle(builderDependency('openpgp'))
  assert.equal(existsSync(join(signed.outputDir, 'index.json.sig')), true)

  const previousKey = process.env[SIGNING_KEY_VAR]
  delete process.env[SIGNING_KEY_VAR]
  try {
    const rebuilt = await buildBundle({ sourceRoot: APP_REPO_DIR, outputDir: signed.outputDir, channel: 'dev' })
    assert.equal(rebuilt.signed, false)
    assert.equal(existsSync(join(signed.outputDir, 'index.json.sig')), false)
    assert.equal(rebuilt.peeled, signed.packages.length, 'every package signed by the previous run must be peeled')
    rebuilt.packages.forEach((packed) => {
      const stale = new AdmZip(packed.path).getEntry('manifest.json.sig')
      assert.equal(stale, null, `${packed.filename}: unsigned rebuild left a signature the app would refuse`)
    })
  } finally {
    if (previousKey !== undefined) process.env[SIGNING_KEY_VAR] = previousKey
  }
})
