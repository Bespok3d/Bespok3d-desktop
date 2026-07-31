// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The relocation rail (relay packet 4): proves app-bundle.mjs's buildBundle() still reproduces the
// pre-consolidation monorepo bundle (the bundled index content, the packed .b3 filename set, and the
// staged doc content), against the golden relocated here from b3-builder/test/golden/monorepo (the
// ONLY consumer of that golden was the now-deleted compat quarantine). Per the watch-point, this
// compares PARSED CONTENT, never raw bytes or key order.
//
// WHICH PLUGINS IT BUILDS. The golden's own bundled-plugins.json, never scripts/bundle.dev.json: that
// file is a developer's scratch curation of their local dev build, and a rail that read it would go
// red the moment someone trimmed their own list. Editing the dev list is free; editing the fixture is
// a deliberate change to what the golden claims.
//
// WHAT THE GOLDEN MAY AND MAY NOT PIN. buildBundle passes plugin-content fields (version, dates, the
// version-bearing .b3 filename) straight through from each manifest, so a golden that froze their
// VALUES asserted the plugins' content rather than buildBundle's orchestration, and every legitimate
// plugin release turned this rail red: it sat red on camera-hw-accel 0.1.6 -> 0.1.8 plus two rebaked
// +dev hashes, none of which say anything about the code under test. Those fields are now asserted by
// SHAPE and the golden pins everything else exactly. Staged docs are checked against the SOURCE doc
// tree rather than a frozen digest map, which is strictly stronger (it proves a faithful copy of what
// actually ships) and cannot rot.
//
// A SECOND rail further down does pin those values, deliberately: a fixture that no longer describes
// the plugins as they are now is a real defect (the app would advertise versions the store cannot hand
// out), and it is only reasonable to assert BECAUSE `npm run golden:refresh` now clears it in one
// command. Keep the two apart: this rail is about buildBundle's orchestration and must stay quiet on a
// plugin release; that one is about the fixture being current.
//
// This does not re-verify .b3 archive content byte-for-byte: that invariant is b3-builder's own
// equivalence rail's job (it exercises packIfChanged/packPlugin directly against real plugin dirs).
// This rail's job is the app-side orchestration: did buildBundle() discover the right plugins, produce
// the right catalog entries, and stage the right doc files.
//
// Run with: node --test scripts/test/app-bundle.test.mjs

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildIndex, firstSourcePerName } from '../app-bundle.mjs'
import {
  GOLDEN_DIR,
  PLUGIN_SOURCES_DIR,
  REFRESH_COMMAND,
  buildGoldenBundle,
  goldenDevCuration,
  goldenIndexText,
  hasPluginSources,
  packedArchiveStems,
  readGoldenArchives,
  readGoldenIndexText,
  withoutDevBuildTags,
} from '../monorepo-golden.mjs'
import { APP_REPO_DIR, WORKSPACE_DIR, builderCore, ensureBuilderBuilt, makeScratchOutputDir } from './builder-checkout.mjs'

// A checkout of this repo ALONE has no plugin repos beside it, so the rails that build a real bundle
// have nothing to build one from. That is a supported checkout (the contributor who cloned only the
// app), not a red gate on their first run: they stand down and say why. Inside the workspace the tree
// is there and they run, so this can never quietly stand in for the real thing.
const NEEDS_PLUGIN_SOURCES = hasPluginSources() ? {} : { skip: `no plugin repos at ${PLUGIN_SOURCES_DIR}` }

// One real bundle for the whole file: a run compiles the sibling builder and writes ~60MB of packages,
// and every rail below asks a different question of the same build.
const goldenBundleRun = { built: null }

function bundledOnce() {
  goldenBundleRun.built ??= buildBundleForRails()

  return goldenBundleRun.built
}

async function buildBundleForRails() {
  ensureBuilderBuilt()
  const outputDir = makeScratchOutputDir('app-bundle-')
  const built = await buildGoldenBundle(outputDir)

  return { ...built, outputDir }
}

function loadGolden(name) {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, name), 'utf8'))
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(full) : [full]
  })
}

// Every file under each `<name>/doc/` tree staged beside the bundled index, as
// { "<name>/doc/<relpath>": sha256 }.
function describeStagedDocs(root) {
  const plugins = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  const pairs = plugins.flatMap((plugin) => {
    const docDir = join(root, plugin.name, 'doc')
    if (!existsSync(docDir)) return []
    return filesUnder(docDir).map((absPath) => [relative(root, absPath), sha256Hex(readFileSync(absPath))])
  })
  return Object.fromEntries(pairs)
}

// The same shape read off the SOURCE doc trees: what a faithful staging pass must have produced.
// Reuses buildBundle's own first-source-per-name rule rather than restating it, so the expectation
// cannot drift from the staging it checks (one id can carry a stable atom plus a dev variant, and
// only the stable one's docs stage).
function describeSourceDocs(sources) {
  const pairs = firstSourcePerName(sources).flatMap((source) => {
    const docDir = join(source.dir, 'doc')
    if (!existsSync(docDir)) return []
    return filesUnder(docDir).map((absPath) =>
      [join(source.name, 'doc', relative(docDir, absPath)), sha256Hex(readFileSync(absPath))])
  })
  return Object.fromEntries(pairs)
}

// A catalog entry with the manifest-passthrough fields blanked, so the golden pins what buildBundle
// DERIVES and never what the plugins happen to ship this week. Shape is asserted separately.
// `publisher` is blanked for the opposite reason (it is derived from whichever key the build carries,
// so its value belongs to the key and not to the golden) and is bought back below by an assertion that
// every entry names the same publisher as the index header. `sw_version` (the packaged upstream
// version) and `author` (the display name) are manifest passthrough too: `sw_version` bumps on every
// wrapper upgrade exactly like `version`, so freezing its value would rot this rail red the same way.
const PASSTHROUGH_FIELDS = ['version', 'updated_at', 'download_url', 'publisher', 'sw_version', 'author']

function withoutPassthroughValues(entry) {
  const blanked = PASSTHROUGH_FIELDS.filter((field) => field in entry).map((field) => [field, `<${field}>`])
  return { ...entry, ...Object.fromEntries(blanked) }
}

// `publisher` joins the blanked set for the same reason as the passthrough fields: it is DERIVED from
// a key (the signing key when the build has one, the checked-in list key otherwise), so its value
// belongs to whichever key is in play, not to buildBundle's orchestration. What the blanking gives up
// is bought back below, by the drift test that pins it to the key the app itself trusts, which is a
// stronger claim than the frozen literal ever made.
function withoutVolatileValues(index) {
  return {
    ...index,
    publisher: '<publisher>',
    updated: '<updated>',
    plugins: index.plugins.map(withoutPassthroughValues),
    collections: index.collections.map(withoutPassthroughValues),
  }
}

// What the blanking gives up, bought back as a shape assertion: a passthrough field may move, but it
// still has to be a well-formed value and the .b3 filename still has to agree with the entry it serves.
function assertPassthroughWellFormed(entry) {
  assert.match(entry.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+dev\.[0-9a-f]{8})?$/, `${entry.name}: malformed version`)
  assert.match(entry.updated_at, /^\d{4}-\d{2}-\d{2}/, `${entry.name}: malformed updated_at`)
  if (!('download_url' in entry)) return
  const cleanVersion = entry.version.split('+')[0]
  assert.equal(entry.download_url, `${entry.name}-${cleanVersion}.b3`, `${entry.name}: download_url disagrees with version`)
}

const LIST_PUBLIC_KEY_PATH = join(WORKSPACE_DIR, 'main-index', 'keys', 'bespok3d-list.pub.asc')
const APP_VERIFY_PATH = join(APP_REPO_DIR, 'src', 'main', 'registry', 'resolve', 'verify.ts')

// The armored key the APP carries as its trust anchor, read out of its source rather than imported:
// this is a .mjs node test and verify.ts is renderer-side TypeScript, so the key block is lifted
// textually. Nothing else in that file matches a PGP public key block.
function appPinnedPublicKey() {
  const source = readFileSync(APP_VERIFY_PATH, 'utf8')
  const keyBlock = source.match(/-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]*?-----END PGP PUBLIC KEY BLOCK-----/)
  assert.ok(keyBlock, `${APP_VERIFY_PATH} no longer carries an armored public key block`)

  return keyBlock[0]
}

test('buildBundle (dev channel) reproduces the pre-consolidation monorepo golden', { timeout: 300_000, ...NEEDS_PLUGIN_SOURCES }, async () => {
  const { packages, index, sources, outputDir } = await bundledOnce()

  assert.deepEqual(withoutVolatileValues(index), withoutVolatileValues(loadGolden('index.json')))

  // The buy-back for blanking `publisher` above, and a stronger claim than the frozen literal made:
  // an UNSIGNED build (this one carries no signing key) advertises the org's published list key, so
  // an offline bundle names the same identity the online index does rather than a typed-in constant.
  const core = await builderCore()
  assert.equal(index.publisher, await core.publicKeyFingerprint(readFileSync(LIST_PUBLIC_KEY_PATH, 'utf8')))

  // Every catalog entry names the identity the build derived, never the placeholder its source repo
  // shipped: an entry offering a package under a publisher the package itself does not name is two
  // claims that can disagree, and the disagreement surfaces as a refused install, not a wrong label.
  const entryPublishers = [...index.plugins, ...index.collections].map((entry) => entry.publisher)
  assert.deepEqual([...new Set(entryPublishers)], [index.publisher])
  index.plugins.forEach(assertPassthroughWellFormed)
  index.collections.forEach(assertPassthroughWellFormed)

  assert.deepEqual(packedArchiveStems(packages), readGoldenArchives(), STALE_GOLDEN_MESSAGE)

  // The pack and the index must name the same artifacts: a .b3 the catalog does not point at is
  // unreachable, and a download_url with no .b3 behind it is a broken install.
  const advertised = index.plugins.filter((entry) => 'download_url' in entry).map((entry) => entry.download_url).sort()
  assert.deepEqual(packages.map((packed) => packed.filename).sort(), advertised)

  assert.deepEqual(describeStagedDocs(outputDir), describeSourceDocs(sources))
})

// The rail above blanks the manifest-passthrough values on purpose, so it stays quiet when a plugin
// ships a release. Something still has to notice that the committed fixture no longer describes the
// plugins as they are now: an app built against a stale fixture advertises versions the store cannot
// hand out. This is that check, and it is only sane BECAUSE the refresh command exists: the fix is one
// command, never a hand-edit of the fixture.
const STALE_GOLDEN_MESSAGE = `the committed golden no longer matches the plugin manifests. Run \`${REFRESH_COMMAND}\` and commit the result with the manifest change that caused it.`

test('the committed golden is what the refresh command produces', { timeout: 300_000, ...NEEDS_PLUGIN_SOURCES }, async () => {
  const { index } = await bundledOnce()

  // Content first, so a drift reports as a readable field diff rather than as two walls of JSON, then
  // the bytes, which also catch a fixture that was re-ordered or re-indented by hand.
  assert.deepEqual(withoutDevBuildTags(index), JSON.parse(readGoldenIndexText()), STALE_GOLDEN_MESSAGE)
  assert.equal(goldenIndexText(index), readGoldenIndexText(), STALE_GOLDEN_MESSAGE)
})

// The rails build what bundled-plugins.json names, and NOTHING here reads scripts/bundle.dev.json: a
// developer trimming their own dev list must never turn someone else's check red (it did, on
// 2026-07-30). This fails if the golden is ever wired back to that file, because the index it produced
// would then describe whatever list the developer happens to carry instead of the fixture's own.
test('the golden describes the plugin set its own fixture names', () => {
  const claimed = JSON.parse(readGoldenIndexText())
  const described = [...claimed.plugins, ...claimed.collections].map((entry) => entry.name)

  assert.deepEqual([...new Set(described)].sort(), [...goldenDevCuration().bundle].sort(), STALE_GOLDEN_MESSAGE)
})

// The other half of the buy-back, and the drift guard the mirror rule demands: the list public key is
// checked in TWICE (main-index/keys, which the bundled build derives its publisher from, and inside the
// app's verify.ts, which the app pins as its install-time trust anchor). If those two ever name different
// keys, every bundled package the app installs is refused as signed-by-an-unpinned-key, which is a hard
// PackageRefusedError rather than a downgrade. This fails the moment one side is rotated without the other.
test('the key the bundled build signs with is the key the app pins as its trust anchor', async () => {
  ensureBuilderBuilt()
  const core = await builderCore()

  const listKeyFingerprint = await core.publicKeyFingerprint(readFileSync(LIST_PUBLIC_KEY_PATH, 'utf8'))
  const appAnchorFingerprint = await core.publicKeyFingerprint(appPinnedPublicKey())

  assert.equal(listKeyFingerprint, appAnchorFingerprint)
})

// Single-source-of-truth guard (relay packet 4 fix). app-bundle.mjs cannot import b3-builder's built
// core on its pure buildIndex path (the app's vitest loads buildIndex without building the sibling
// repo), so it MIRRORS the canonical catalog-entry primitives. Per the SoT rule, an unavoidable mirror
// gets a drift test that fails on divergence. This asserts the app's bundled index entry agrees with
// b3-builder's canonical sharedEntryFields on every field the two flavors SHARE. The app entry adds
// resolved deps + a disk-relative doc_url + a download_url on top: that is the caller-specific flavor,
// deliberately not shared, so it is not asserted here.
test('bundled index entry does not drift from b3-builder core on the shared catalog base', async () => {
  ensureBuilderBuilt()
  const core = await builderCore()
  const manifest = {
    name: 'sample-plugin',
    title: 'Sample Plugin',
    version: '1.2.3',
    description: 'A representative plugin exercising every shared catalog field.',
    tagline: 'Does a representative thing.',
    category: 'utility',
    channel: 'stable',
    publisher: 'sample-publisher',
    printer_specific: true,
    published_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-02T00:00:00Z',
    provides: [{ service: 'sample-service' }],
    conflicts: ['other-plugin'],
    requires: { capabilities: ['camera'] },
    icon: 'icon.svg',
    min_daemon_version: '0.10.0',
    homepage: 'https://example.com',
    macros: { SAMPLE: 'value' },
    config: { key: 'value' },
    changelog: 'CHANGELOG.md',
    endpoints: [{ path: '/sample' }],
  }

  const appEntry = buildIndex([manifest]).plugins[0]
  const coreShared = core.sharedEntryFields(manifest)

  Object.keys(coreShared).forEach((field) => {
    assert.deepEqual(appEntry[field], coreShared[field], `shared catalog field "${field}" drifted from b3-builder core`)
  })
})
