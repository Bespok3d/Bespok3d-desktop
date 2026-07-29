// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The chain rail: what the BUILDER signs is checked here by the APP's own install-time code, over the
// same bytes, at both levels the app checks in production (the manifest.json inside a packed .b3, and a
// registry index). At the index level the app's entry point is `verifyIndexSignature`, which pins the
// ORG's public key inside itself, so its accepting path cannot be reached with a throwaway key; the rail
// drives the predicate it delegates to (`fingerprintOfValidSigner`) with the anchor supplied, and covers
// `verifyIndexSignature` itself only on its no-signature path.
// Every other signing test in this repo verifies builder output with the builder's own
// verifier, which proves self-consistency and nothing about the chain: the app ships a SECOND, separate
// openpgp implementation, so the two can drift (a framing change, a different first-signature rule, an
// encoding round trip) while every local check stays green and real installs start refusing, or worse,
// accepting. Nothing else in the gate would catch that.
//
// The second half is the drift guard system-map.md:66 requires for a sanctioned mirror (ADR-0041 keeps
// the build system its own publisher-facing repo, so the primitive stays mirrored on purpose): one
// matrix of bytes/signature/key cases run through BOTH implementations, asserting they reach the same
// accept-or-reject verdict. Neither repo's code moves.
//
// The app's verification is TypeScript, and node --test cannot import TS, so it is compiled here with
// the app's OWN esbuild into the app's OWN node_modules: openpgp and adm-zip then resolve to the exact
// versions the app ships, which is the whole point of the comparison. This is the app's real source
// compiled the way electron-vite compiles it, never a copy of its logic.
//
// The key is generated per run and discarded with the process: the org's private key is never in this
// repo and never in a test.
//
// Run with: node --test scripts/test/signing-chain.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

import { APP_REPO_DIR, builderCore, builderDependency, ensureBuilderBuilt, makeScratchOutputDir } from './builder-checkout.mjs'

// Obviously-fake plugin source: the rail is about signatures over bytes, so the payload only has to be
// a real packable tree that the app's manifest parser accepts.
const FIXTURE_MANIFEST = {
  name: 'chain-rail-fixture',
  version: '1.0.0',
  title: 'Chain Rail Fixture',
  description: 'packed by the signing-chain rail and installed by nothing',
  install: { config: [] },
}

const FIXTURE_ENTRY = { name: FIXTURE_MANIFEST.name, version: FIXTURE_MANIFEST.version }

// Compiled once for the whole file. Both tests below need it, and the second import() would be served
// from the module cache anyway, so a second buildSync would be a tsc-sized cost that changes nothing.
const compiledAppVerification = { loading: null }

function appVerification() {
  if (compiledAppVerification.loading) return compiledAppVerification.loading

  const appRequire = createRequire(join(APP_REPO_DIR, 'package.json'))
  const cacheDir = join(APP_REPO_DIR, 'node_modules', '.cache', 'signing-chain-rail')
  mkdirSync(cacheDir, { recursive: true })
  const bundlePath = join(cacheDir, 'app-verification.mjs')
  appRequire('esbuild').buildSync({
    stdin: {
      contents: [
        "export { verifiedPackageTrust } from './store/verify-package'",
        "export { PackageRefusedError } from './store/package-refused'",
        "export { fingerprintOfValidSigner, verifyIndexSignature } from './registry/resolve/verify'",
      ].join('\n'),
      resolveDir: join(APP_REPO_DIR, 'src', 'main'),
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    external: ['openpgp', 'adm-zip', 'electron'],
    outfile: bundlePath,
  })

  compiledAppVerification.loading = import(pathToFileURL(bundlePath).href)

  return compiledAppVerification.loading
}

async function throwawaySigner(openpgp, name) {
  const generated = await openpgp.generateKey({
    userIDs: [{ name, email: 'signer@example.invalid' }],
    format: 'object',
  })

  return { privateKey: generated.privateKey.armor(), publicKey: generated.publicKey.armor() }
}

// A real .b3 through the builder's real packer, signed the way the pipeline signs one: publisher stamped
// from the signing key first, then the detached signature over the packed manifest bytes.
async function packSignedFixture(core, signer, outputDir) {
  const sourceDir = join(outputDir, 'fixture-source')
  mkdirSync(join(sourceDir, 'files'), { recursive: true })
  writeFileSync(join(sourceDir, 'files', 'fixture.cfg'), '# chain rail fixture payload\n')
  writeFileSync(join(sourceDir, 'manifest.json'), `${JSON.stringify(FIXTURE_MANIFEST, null, 2)}\n`)
  const packed = core.packIfChanged(FIXTURE_MANIFEST, sourceDir, outputDir, core.builderVersion())
  core.stampManifestPublisherInPlace(packed.path, await core.signingKeyFingerprint(signer.privateKey))
  await core.signManifestInPlace(packed.path, signer.privateKey)

  return packed.path
}

// The bytes a registry index is served as, framed exactly as every producer frames them.
function servedIndexBytes(publisher) {
  return Buffer.from(`${JSON.stringify({ version: 1, publisher, plugins: [FIXTURE_ENTRY], collections: [] }, null, 2)}\n`)
}

function anchorsTrusting(armoredPublicKey) {
  return [{ armoredKey: armoredPublicKey, tier: 'project' }]
}

async function refusalOf(verifying) {
  return verifying.then(() => null, (refusal) => refusal)
}

// The installer refuses a package for several unrelated reasons (no manifest, a name or version that
// disagrees with the registry entry, an empty file list, a bad signature) and they all arrive as the
// same error type. A signature case that passed because one of the OTHER refusals fired would prove
// nothing about the chain, so the reason is asserted, not just the refusal.
function assertRefusedOverTheSignature(app, refusal, why) {
  assert.ok(refusal instanceof app.PackageRefusedError, why)
  assert.match(refusal.message, /signature .* does not check out/, `${why} (refused, but not over the signature)`)
}

test('the app accepts what the builder signs, and refuses what it must', { timeout: 300_000 }, async (rail) => {
  ensureBuilderBuilt()
  const openpgp = builderDependency('openpgp')
  const AdmZip = builderDependency('adm-zip')
  const core = await builderCore()
  const app = await appVerification()
  const signer = await throwawaySigner(openpgp, 'Throwaway Chain Signer')
  const impostor = await throwawaySigner(openpgp, 'Throwaway Impostor')
  const outputDir = makeScratchOutputDir('signing-chain-')
  const packagePath = await packSignedFixture(core, signer, outputDir)
  const packageBytes = readFileSync(packagePath)

  await rail.test('a builder-signed .b3 earns its anchor tier from the app installer', async () => {
    assert.equal(await app.verifiedPackageTrust(packageBytes, FIXTURE_ENTRY, anchorsTrusting(signer.publicKey)), 'project')
  })

  // The signature covers the manifest bytes, so an edited manifest is a different package wearing the
  // signature of the one that was vouched for. The app must refuse rather than install it untrusted.
  await rail.test('a package whose manifest was edited after signing is refused', async () => {
    const tampered = new AdmZip(packageBytes)
    const manifest = JSON.parse(tampered.getEntry('manifest.json').getData().toString('utf8'))
    tampered.updateFile('manifest.json', Buffer.from(`${JSON.stringify({ ...manifest, title: 'Edited After Signing' }, null, 2)}\n`))
    const refusal = await refusalOf(app.verifiedPackageTrust(tampered.toBuffer(), FIXTURE_ENTRY, anchorsTrusting(signer.publicKey)))
    assertRefusedOverTheSignature(app, refusal, 'an edited manifest must be refused, not installed')
  })

  await rail.test('a package signed by a key the app does not trust is refused', async () => {
    const refusal = await refusalOf(app.verifiedPackageTrust(packageBytes, FIXTURE_ENTRY, anchorsTrusting(impostor.publicKey)))
    assertRefusedOverTheSignature(app, refusal, 'a signature from an unpinned key is no proof, so the package must be refused')
  })

  // NO-DOWNGRADE: an ABSENT signature is missing proof rather than failed proof, so it installs at tier
  // 'unknown'. Refusing it here would make every unsigned build uninstallable.
  await rail.test('a package with its signature stripped installs as unknown rather than refused', async () => {
    const strippedPath = join(outputDir, 'stripped.b3')
    writeFileSync(strippedPath, packageBytes)
    assert.equal(core.unsignManifestInPlace(strippedPath), true)
    assert.equal(await app.verifiedPackageTrust(readFileSync(strippedPath), FIXTURE_ENTRY, anchorsTrusting(signer.publicKey)), 'unknown')
  })

  await rail.test('a builder-signed index names its signing key to the app verifier', async () => {
    const publisher = await core.signingKeyFingerprint(signer.privateKey)
    const indexBytes = servedIndexBytes(publisher)
    const signature = await core.signDetached(indexBytes, signer.privateKey)
    assert.equal(await app.fingerprintOfValidSigner(indexBytes, signature, signer.publicKey), publisher.toUpperCase())
  })

  // An index is never refused, it loses its badge: the store still loads at trust tier 'unknown'.
  await rail.test('an altered index, a foreign key, and a missing signature all leave the index unproven', async () => {
    const publisher = await core.signingKeyFingerprint(signer.privateKey)
    const indexBytes = servedIndexBytes(publisher)
    const signature = await core.signDetached(indexBytes, signer.privateKey)
    const altered = Buffer.concat([indexBytes, Buffer.from(' ')])
    assert.equal(await app.fingerprintOfValidSigner(altered, signature, signer.publicKey), null)
    assert.equal(await app.fingerprintOfValidSigner(indexBytes, signature, impostor.publicKey), null)
    assert.equal(await app.verifyIndexSignature(indexBytes.toString('utf8'), null), null)
  })
})

// The drift guard. The behaviour that must not diverge is the verdict: these exact bytes, with this
// signature, against this key, are either accepted or they are not. The two implementations return
// different shapes (a boolean one side, a fingerprint or null the other) and refuse differently (the
// builder lets openpgp throw on a malformed signature, the app catches it and returns null), so the
// comparison is over the VERDICT and not the return value. If either side ever starts accepting or
// rejecting a case the other does not, this fails.
async function builderAccepts(core, testCase) {
  return core.verifyDetached(testCase.bytes, testCase.signature, testCase.publicKey).catch(() => false)
}

async function appAccepts(app, testCase) {
  return app.fingerprintOfValidSigner(testCase.bytes, testCase.signature, testCase.publicKey).then((fingerprint) => fingerprint !== null)
}

async function assertBothReachTheSameVerdict(core, app, testCase) {
  const builderVerdict = await builderAccepts(core, testCase)
  const appVerdict = await appAccepts(app, testCase)
  assert.equal(builderVerdict, testCase.expected, `the build system's verdict changed on: ${testCase.name}`)
  assert.equal(appVerdict, testCase.expected, `the app's verdict changed on: ${testCase.name}`)
  assert.equal(builderVerdict, appVerdict, `the two implementations disagree on: ${testCase.name}`)
}

function driftCases(signed, signer, impostor) {
  return [
    { name: 'the signed bytes, its signature, the signing key', expected: true, bytes: signed.bytes, signature: signed.signature, publicKey: signer.publicKey },
    { name: 'one flipped byte', expected: false, bytes: signed.flippedBytes, signature: signed.signature, publicKey: signer.publicKey },
    { name: 'the same content re-serialized', expected: false, bytes: signed.reserializedBytes, signature: signed.signature, publicKey: signer.publicKey },
    { name: 'a key that did not sign', expected: false, bytes: signed.bytes, signature: signed.signature, publicKey: impostor.publicKey },
    { name: 'a valid signature over other bytes', expected: false, bytes: signed.bytes, signature: signed.otherSignature, publicKey: signer.publicKey },
    { name: 'a malformed signature', expected: false, bytes: signed.bytes, signature: 'not a pgp signature at all', publicKey: signer.publicKey },
    { name: 'an empty signature', expected: false, bytes: signed.bytes, signature: '', publicKey: signer.publicKey },
  ]
}

async function signedDriftMaterial(core, signer) {
  const value = { name: 'chain-rail-fixture', version: '1.0.0' }
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  const flippedBytes = Buffer.from(bytes)
  flippedBytes[flippedBytes.length - 2] ^= 0x01

  return {
    bytes,
    flippedBytes,
    reserializedBytes: Buffer.from(JSON.stringify(value)),
    signature: await core.signDetached(bytes, signer.privateKey),
    otherSignature: await core.signDetached(Buffer.from('other bytes entirely\n'), signer.privateKey),
  }
}

test('both verify implementations reach the same verdict on every case', { timeout: 300_000 }, async (guard) => {
  ensureBuilderBuilt()
  const openpgp = builderDependency('openpgp')
  const core = await builderCore()
  const app = await appVerification()
  const signer = await throwawaySigner(openpgp, 'Throwaway Drift Signer')
  const impostor = await throwawaySigner(openpgp, 'Throwaway Drift Impostor')
  const signed = await signedDriftMaterial(core, signer)

  await Promise.all(driftCases(signed, signer, impostor)
    .map((testCase) => guard.test(testCase.name, () => assertBothReachTheSameVerdict(core, app, testCase))))
})
