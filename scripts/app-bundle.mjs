// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The app's offline-bundle build glue (relay packet 4, the relocation). Owns everything app-flavored
// that b3-builder must never contain: which plugins this app bundles (bundle.json / bundle.dev.json),
// dev/release curation, dev-only channel variants, the `+dev` build-tag, the combined "Bespok3d
// Official" catalog, and doc-staging beside the served index. b3-builder is called as an ordinary
// library (its packIfChanged + builderVersion, imported from its built dist/core) for the one thing it
// owns: turning a plugin dir into a `.b3`. REPLACES scripts/generate-index.mjs.
//
// buildIndex / variantSources / devBuildTag are pure (or fs-injected) so they can be unit-tested
// without a real build; they carry the SAME signatures generate-index.mjs had, so the app's test
// importers re-point by path only. buildBundle is the new full orchestration pack-plugins.sh delegates
// to: discover the bundled + variant set, pack each via b3-builder (skip-if-unchanged on), assemble the
// index, stage docs, write index.json.
//
// The catalog-shape helpers below (providerByService, resolveStoreDeps, atomKey, latestUpdated,
// isCollection, assertUniqueAtoms, copyIfPresent) are deliberately self-contained rather than imported
// from b3-builder's core, for two reasons. First, requiredServices here is tolerant of BOTH the
// service-model `require` form and the legacy flat `depends` form (the app's own test fixtures still
// exercise the legacy form); the core's requiredServiceNames supports only `require`, so reusing it
// would silently break dep resolution for a legacy-shaped manifest. Second, reusing b3-builder's core
// at all means importing its built dist/core (b3-builder must be built first); doing that at module
// TOP LEVEL would force every vitest run that merely loads this file for buildIndex to require
// b3-builder pre-built first, which nothing in the app's own test/pretest hooks guarantees. Only
// buildBundle's real packing step needs b3-builder, so ONLY it imports the dist, and lazily (dynamic
// `import()` inside the function body), so loading this module for its pure functions never touches
// b3-builder at all.
//
// Because the pure path cannot import the sibling core, the catalog-base primitives here (the shared
// entry fields, atomKey, latestUpdated, isCollection) are a deliberate mirror of b3-builder's canonical
// copies. Per the single-source-of-truth rule for an unavoidable mirror, a cross-boundary drift test
// (scripts/test/app-bundle.test.mjs) asserts this entry agrees with the core's sharedEntryFields on
// every field the two flavors share; the app entry adds resolved deps + a disk-relative doc_url +
// download_url on top, which are the caller-specific flavor and deliberately not shared.

import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { SIGNING_KEY_VAR, listPublisher, signPackages, stampPublisher, writeSignedIndex } from './bundle-signing.mjs'

const REGISTRY_NAME = 'Bespok3d Official'
const REGISTRY_PUBLISHER = 'PLACEHOLDER'
const INDEX_SCHEMA_VERSION = 1
const BASE_DEPENDENCY = 'base'
// Services the DAEMON serves, never a plugin. A manifest that requires one of these is asking for a
// new-enough daemon build, not for another plugin to be installed, so it must never resolve to a
// store dep: no plugin has that id and the install would chase a package that does not exist.
// Mirrors daemon/core/packages/daemon_services.py, pinned to it by build-index.test.ts.
export const DAEMON_SERVED_SERVICES = new Set(['migrate-patch'])

// Plugin sources live in the sibling `plugins/` tree (the repo split: each plugin/co-repo is its own
// dir, e.g. plugins/u1-hw-camera/plugin or plugins/u1-klipper-config-enhancers/cpu-temp). Discovery
// scans that tree for manifests. A plugin's identity is its manifest .name, not its directory name,
// so the layout (a solo repo's `plugin/` vs a co-repo's `<id>/`) does not matter.
const DISCOVERY_MAX_DEPTH = 4
const SKIP_DIRS = new Set(['dist', 'node_modules', '.git', '.github', 'files', 'doc', 'scripts'])

function dependencyName(dependency) {
  return dependency.split('@')[0]
}

// Tolerant of both the service-model form (`provides: [{service}]`, `require: [{service}]`)
// and the legacy flat form (`provides: ["x"]`, `depends: ["x@>=1.0"]`) during the migration.
function serviceName(provided) {
  return typeof provided === 'string' ? provided : provided.service
}

function requiredServices(manifest) {
  const declared =
    manifest.require !== undefined
      ? manifest.require.map((requirement) => requirement.service)
      : (manifest.depends ?? []).map(dependencyName).filter((service) => service !== BASE_DEPENDENCY)

  return declared.filter((service) => !DAEMON_SERVED_SERVICES.has(service))
}

function providerByService(manifests) {
  const providers = {}
  manifests.forEach((manifest) => {
    ;(manifest.provides ?? []).forEach((provided) => {
      const service = serviceName(provided)
      if (!(service in providers)) providers[service] = manifest.name
    })
  })
  return providers
}

// The catalog "deps" are store plugin ids. They are derived from the service graph:
// a manifest that requires a service resolves to whichever plugin provides it. The
// base layer is not a store plugin, so it is dropped.
function resolveStoreDeps(manifest, providers) {
  const resolved = []
  requiredServices(manifest).forEach((service) => {
    const providerId = providers[service] ?? service
    if (!resolved.includes(providerId)) resolved.push(providerId)
  })
  return resolved
}

function copyIfPresent(target, source, keys) {
  keys.forEach((key) => {
    if (source[key] !== undefined) target[key] = source[key]
  })
}

// A client must render the store card and the full detail page from the index ALONE,
// without downloading the .b3 (saves bandwidth on capped connections and avoids inflating
// the package download count for plugins the user only browses). So every display field is
// either inline here or referenced as a URL to web-renderable markdown plus its media. The
// .b3 is install payload only. doc_url/changelog_url are disk-relative for the bundled list
// and absolute URLs when published; media inside resolves relative to the doc file.
// The capture tab tails a plugin's log. An explicit manifest `log` block (path / named captures)
// wins; otherwise a managed-service plugin gets an empty marker so the renderer shows the tab and
// the daemon defaults to the service's wrapper log. No service and no block => no log, no tab.
function logSource(manifest) {
  if (manifest.log) return manifest.log
  const services = manifest.install?.service ?? []
  return services.length > 0 ? {} : undefined
}

// One id can carry several channel atoms in the same index (a stable atom beside a dev-bundled
// experiment variant), so anything held per-atom keys on name@version, never on name alone: a
// name-keyed map would silently apply one atom's value to its same-id sibling.
function atomKey(manifest) {
  return `${manifest.name}@${manifest.version}`
}

// A dev-only build-tag: semver build metadata `+dev.<hash8>` appended to the DISPLAYED version of a
// dev-bundled atom so an iterating build is visibly distinct without a semver bump. Build metadata is
// precedence-neutral, so update detection never fires on it (the renderer strips `+...` before
// comparing). The download_url keeps the clean manifest version (the packed .b3 filename).
export function devBuildTag(fileEntries) {
  const sorted = [...fileEntries].sort((earlier, later) => earlier.path.localeCompare(later.path))
  const digest = sorted.reduce((hash, entry) => hash.update(entry.path).update('\0').update(entry.bytes), createHash('sha256'))
  return `+dev.${digest.digest('hex').slice(0, 8)}`
}

// A collection (kind:collection) is install-orchestration metadata, never an installable artifact:
// it lists member plugin ids + version constraints and ships no files/, no install block, no .b3. It
// is emitted into a separate collections[] so it never reaches .b3 resolution downstream.
function isCollection(manifest) {
  return manifest.kind === 'collection'
}

function buildCollectionEntry(manifest) {
  const entry = {
    name: manifest.name,
    title: manifest.title,
    version: manifest.version,
    description: manifest.description,
    tagline: manifest.tagline,
    category: manifest.category,
    channel: manifest.channel,
    publisher: manifest.publisher,
    printer_specific: manifest.printer_specific ?? false,
    published_at: manifest.published_at,
    updated_at: manifest.updated_at,
    members: manifest.members ?? [],
    doc_url: `${manifest.name}/doc/README.md`,
  }
  // `migration` is the publisher saying an installed plugin of this id is retiring into the set: the
  // versions the takeover was written for and the sentence the user reads before it runs. Dropped here,
  // an offline install has no way to tell the user their plugin is about to be taken off.
  copyIfPresent(entry, manifest, ['icon', 'homepage', 'author', 'attributions', 'migration'])
  applyLicenseUrl(entry, manifest)
  if (manifest.changelog) entry.changelog_url = `${manifest.name}/${manifest.changelog}`
  return entry
}

// Unlike the changelog, a licence file is never staged next to the index and never a release asset: it
// lives in the plugin's own repo and the store only links out to it. So the manifest carries the whole
// link and the entry passes it through, rather than a disk-relative path.
function applyLicenseUrl(entry, manifest) {
  if (manifest.license) entry.license_url = manifest.license
}

function latestUpdated(entries) {
  return entries.reduce((latest, entry) => (entry.updated_at > latest ? entry.updated_at : latest), '')
}

function buildIndexEntry(manifest, providers, buildTags) {
  const entry = {
    name: manifest.name,
    title: manifest.title,
    version: `${manifest.version}${buildTags[atomKey(manifest)] ?? ''}`,
    description: manifest.description,
    tagline: manifest.tagline,
    category: manifest.category,
    channel: manifest.channel,
    publisher: manifest.publisher,
    printer_specific: manifest.printer_specific ?? false,
    published_at: manifest.published_at,
    updated_at: manifest.updated_at,
    requires: { capabilities: manifest.requires?.capabilities ?? [] },
    provides: (manifest.provides ?? []).map(serviceName),
    deps: resolveStoreDeps(manifest, providers),
    conflicts: manifest.conflicts ?? [],
    doc_url: `${manifest.name}/doc/README.md`,
    download_url: `${manifest.name}-${manifest.version}.b3`,
  }
  copyIfPresent(entry, manifest, ['icon', 'min_daemon_version', 'min_jinni_version', 'homepage', 'macros', 'config', 'author', 'sw_version', 'attributions', 'migration'])
  applyLicenseUrl(entry, manifest)
  const log = logSource(manifest)
  if (log) entry.log = log
  if (manifest.changelog) entry.changelog_url = `${manifest.name}/${manifest.changelog}`
  const endpoints = manifest.endpoints ?? []
  if (endpoints.length > 0) entry.endpoints = endpoints
  return entry
}

// Two manifests resolving to the same name@version would claim one download_url (and one staged doc
// dir) for two different file trees: one silently shadows the other. Always a misconfiguration
// (typically a channel-variant dir whose manifest was not given its own version), so fail loudly.
function assertUniqueAtoms(manifests) {
  const keys = manifests.map(atomKey)
  const duplicates = [...new Set(keys.filter((key, position) => keys.indexOf(key) !== position))]
  if (duplicates.length > 0) {
    throw new Error(`duplicate atoms (same name and version from more than one source dir): ${duplicates.join(', ')}`)
  }
}

// The publisher defaults to the placeholder so the pure-import path (the app's vitest, which loads this
// module without the sibling repos present) keeps working unchanged; a real buildBundle passes the
// fingerprint derived from the list key.
export function buildIndex(manifests, buildTags = {}, publisher = REGISTRY_PUBLISHER) {
  assertUniqueAtoms(manifests)
  const sorted = [...manifests].sort((earlier, later) => earlier.name.localeCompare(later.name))
  const pluginManifests = sorted.filter((manifest) => !isCollection(manifest))
  const collectionManifests = sorted.filter(isCollection)
  const providers = providerByService(pluginManifests)
  const plugins = pluginManifests.map((manifest) => buildIndexEntry(manifest, providers, buildTags))
  const collections = collectionManifests.map(buildCollectionEntry)
  const updated = latestUpdated([...plugins, ...collections])
  return {
    schema_version: INDEX_SCHEMA_VERSION,
    name: REGISTRY_NAME,
    publisher,
    updated,
    plugins,
    collections,
    lists: [],
  }
}

// Docs stage into an id-keyed dir (per-channel docs are deferred), so when one id carries several
// atoms (stable + dev variant) only the FIRST source of a name stages its doc tree: id-sources come
// before variants, so the stable atom's docs win and the two never race rm/cp on one target dir.
export function firstSourcePerName(sources) {
  return sources.filter((source, position) => sources.findIndex((other) => other.name === source.name) === position)
}

// Stage each plugin's doc/ tree next to the index so the disk-relative doc_url/changelog_url
// and their media resolve from the registry root, exactly as a web host would serve them.
async function stageDocs(fsPromises, pathJoin, distDir, sources) {
  const { cp, rm, stat } = fsPromises
  await Promise.all(firstSourcePerName(sources).map(async ({ name, dir }) => {
    const sourceDoc = pathJoin(dir, 'doc')
    const targetDoc = pathJoin(distDir, name, 'doc')
    const hasDoc = await stat(sourceDoc).then((entry) => entry.isDirectory()).catch(() => false)
    await rm(targetDoc, { recursive: true, force: true })
    if (hasDoc) await cp(sourceDoc, targetDoc, { recursive: true })
  }))
}

// Recursively find every plugin source dir (one holding a manifest.json) under a root, bounded by
// depth and skipping build/scaffold dirs. A plugin dir is a leaf: once its manifest is found we stop
// descending (a plugin never nests another). A COLLECTION dir is NOT a leaf: a co-repo whose root
// manifest is the collection keeps its member plugins in sub-dirs, so stopping at the root hid every
// member from this bundler while pack-plugins.sh's own find still listed them, and the two sides must
// answer the same. The collection root itself is still a source: it carries the index entry members
// point at.
export async function findManifestDirs(readFile, readdir, join, root, depth) {
  if (depth < 0) return []
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const rootManifest = entries.some((entry) => entry.isFile() && entry.name === 'manifest.json')
    ? await readManifestOrNull(readFile, join, root)
    : null
  if (rootManifest && !isCollection(rootManifest)) return [root]
  const subdirs = entries
    .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
    .map((entry) => join(root, entry.name))
  const nested = await Promise.all(subdirs.map((dir) => findManifestDirs(readFile, readdir, join, dir, depth - 1)))

  return rootManifest ? [root, ...nested.flat()] : nested.flat()
}

async function readManifestOrNull(readFile, join, dir) {
  const text = await readFile(join(dir, 'manifest.json'), 'utf8').catch(() => null)

  return text === null ? null : JSON.parse(text)
}

// A dir whose basename IS the plugin id owns that id. Two dirs can carry a manifest with the same id
// (a plugin sitting beside its own experiment build), and readdir hands them over in filesystem
// order, so leaving the winner to that order made this bundler and pack-plugins.sh disagree about
// which dir an id meant: the shell then deleted the .b3 this had just packed. Both sides now apply
// this same rule, so an id means one dir no matter who asks.
export function canonicalSourcePerId(sources) {
  const claimed = new Map()
  sources.forEach((source) => {
    if (outranksClaim(claimed.get(source.name), source)) claimed.set(source.name, source)
  })

  return [...claimed.values()]
}

function outranksClaim(holder, contender) {
  if (!holder) return true

  return basename(holder.dir) !== holder.name && basename(contender.dir) === contender.name
}

// Plugin sources discovered under the sibling `plugins/` tree, plus the daemon's and jinni's staged
// output (`daemon/dist/package`, `adapters/dist/package`). Both repo roots carry a manifest.json of
// their own, so pointing discovery there directly would pack the whole repo as the payload; the
// staging scripts (run by pack-plugins.sh before this runs) produce a clean plugin-shaped dir instead.
// The display `name` is the manifest .name (the index entry and the staged-doc dir both key on it),
// independent of the directory layout. A dir listed in bundle.dev.json variantDirs is NEVER an id
// source, in release mode too: its manifest shares its id with the online atom, and a variant is a
// channel of that id rather than a claim on it. Variants enter only by explicit path, via
// variantSources.
async function pluginSources(readFile, readdir, join, repoDir, variantDirPaths) {
  const roots = [
    join(repoDir, '..', 'plugins'),
    join(repoDir, '..', 'daemon', 'dist', 'package'),
    join(repoDir, '..', 'adapters', 'dist', 'package'),
  ]
  const dirLists = await Promise.all(roots.map((root) => findManifestDirs(readFile, readdir, join, root, DISCOVERY_MAX_DEPTH)))
  const found = await Promise.all(
    dirLists.flat().filter((dir) => !variantDirPaths.has(dir)).map(async (dir) => {
      const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
      return { name: manifest.name, dir, manifest }
    }),
  )

  return canonicalSourcePerId(found, basename)
}

// scripts/bundle.json `bundle` is the RELEASE opt-in list of plugin ids to pack into the bundled
// index; everything else is served online (the default). Empty = online. The dev channel adds the
// dev curation on top (readDevCuration below); a release build never sees it.
async function readBundleList(readFile, join, scriptDir, file) {
  const text = await readFile(join(scriptDir, file), 'utf8').catch(() => '{}')
  return JSON.parse(text).bundle ?? []
}

// A dev-only channel variant: a plugin source dir (relative to the sibling plugins/ tree) bundled by
// explicit path so one id can carry an experiment atom beside its online stable atom, which the
// id-keyed `bundle` list cannot express. A dir whose files/ has not been built yet is skipped, so the
// index never points at a .b3 that has not been produced.
// A named dir that is NOT in the tree is a list that no longer matches the repos, and it is refused
// rather than dropped: dropping it silently is how the golden shrank once without anyone deciding to
// shrink it, the refresh writing the smaller claim and the next run reading that back as correct.
// A dir that is there but carries no built files/ stays a skip: a variant is built by its own repo,
// and a dev build must not depend on somebody having run that first.
async function variantSource(readFile, stat, join, pluginsRoot, relativeDir) {
  const dir = join(pluginsRoot, relativeDir)
  await stat(dir).catch(() => {
    throw new Error(`the plugin variant list names ${relativeDir}, which is not in the plugins tree`)
  })
  const built = await stat(join(dir, 'files')).then((entry) => entry.isDirectory()).catch(() => false)
  if (!built) return null
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
  return { name: manifest.name, dir, manifest }
}

// scripts/bundle.dev.json whole, so a caller can hand buildBundle the same shape in its place. That
// file is a developer's own scratch curation of what their local dev build packs; nothing that has to
// stay green may read it, or editing it turns someone else's check red.
async function readDevCuration(readFile, join, scriptDir) {
  const text = await readFile(join(scriptDir, 'bundle.dev.json'), 'utf8').catch(() => '{}')
  return JSON.parse(text)
}

async function readVariantDirs(readFile, join, scriptDir) {
  return (await readDevCuration(readFile, join, scriptDir)).variantDirs ?? []
}

export async function variantSources(readFile, stat, join, pluginsRoot, scriptDir) {
  if (!process.env.B3D_INCLUDE_DEV_BUNDLE) return []

  return variantSourcesIn(readFile, stat, join, pluginsRoot, await readVariantDirs(readFile, join, scriptDir))
}

async function variantSourcesIn(readFile, stat, join, pluginsRoot, variantDirs) {
  if (!process.env.B3D_INCLUDE_DEV_BUNDLE) return []
  const sources = await Promise.all(
    variantDirs.map((relativeDir) => variantSource(readFile, stat, join, pluginsRoot, relativeDir)),
  )

  return sources.filter(Boolean)
}

// Every file under a dir, as {path: dir-relative, bytes}, for content-hashing the dev build-tag.
async function collectFiles(readdir, readFile, join, base, root = base) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(entries.map((entry) => filesUnder(readdir, readFile, join, base, root, entry)))
  return nested.flat()
}

async function filesUnder(readdir, readFile, join, base, root, entry) {
  const full = join(root, entry.name)
  if (entry.isDirectory()) return collectFiles(readdir, readFile, join, base, full)
  if (!entry.isFile()) return []
  return [{ path: full.slice(base.length + 1), bytes: await readFile(full) }]
}

// Build-tag every dev-only atom (a variant dir, or an id present only in bundle.dev.json) so an
// iterating dev build is visibly distinct. Release-bundled ids and online plugins are never tagged.
async function devBuildTags(readdir, readFile, join, idSources, variants, releaseIds, devIds) {
  const devOnlyIdSources = idSources.filter((source) => devIds.has(source.name) && !releaseIds.has(source.name))
  const taggable = [...devOnlyIdSources, ...variants]
  const pairs = await Promise.all(
    taggable.map(async (source) => [atomKey(source.manifest), devBuildTag(await collectFiles(readdir, readFile, join, join(source.dir, 'files')))]),
  )
  return Object.fromEntries(pairs)
}

// Load b3-builder as a library (built dist, per ADR-0041's consumer 3/4: the app's build glue calls it
// per plugin dir). Lazy/dynamic so importing this module for its pure functions (as the app's tests do)
// never requires b3-builder to be built; only a real buildBundle() run does. The core must already be
// built (`npm run build` in b3-builder), same as pack-plugins.sh's build_core arranges before invoking
// this script.
async function importBuilderCore(ownScriptDir, path, url) {
  const corePath = path.join(ownScriptDir, '..', '..', 'b3-builder', 'dist', 'core', 'index.js')
  return import(url.pathToFileURL(corePath).href)
}

// Bake a not-yet-baked payload, then refuse to pack an unbaked one (ADR-0036 R2). This glue packs via
// b3-builder's packIfChanged primitive, not its full pipeline, so the pipeline's own bake + gate steps
// never run on the bundled build; it enforces the same class-aware invariant by calling the core's
// bakePlugin + assertBaked itself. This is where retired pack-plugins.sh ensure_baked's two jobs now live:
// bakePlugin bakes the presence-driven Python deps (a bundled plugin's baked wheels / site-packages are
// gitignored, so a fresh checkout produces them here), and assertBaked is the refuse-to-pack gate. A
// plugin declaring no payload to bake (the mesh-VPN binaries ship their files/ committed) is untouched.
function ensureBaked(builder, source) {
  if (builder.bakedGaps(source).length > 0) builder.bakePlugin(source)
  builder.assertBaked(source)
}

// Pack every non-collection source (a collection ships no files/, nothing to pack) via b3-builder's
// skip-if-unchanged mode: the app's dev/release build glue always wants it, so an iterating build only
// repacks what actually changed.
function packSources(builder, sources, outputDir) {
  const version = builder.builderVersion()
  const packable = sources.filter((source) => !isCollection(source.manifest))
  return packable.map((source) => packBakedSource(builder, source, outputDir, version))
}

function packBakedSource(builder, source, outputDir, version) {
  ensureBaked(builder, source)
  return builder.packIfChanged(source.manifest, source.dir, outputDir, version)
}

// A bundle-list id that matches no discovered source is refused rather than dropped, for the same
// reason variantSource refuses a missing dir: a pack that exits 0 with a listed plugin quietly
// missing is how a bundle shrinks without anyone deciding to shrink it, and the next golden refresh
// would write the smaller claim back as correct.
function assertBundleResolved(bundledIds, idSources) {
  const resolvedNames = new Set(idSources.map((source) => source.name))
  const unresolved = [...bundledIds].filter((id) => !resolvedNames.has(id))
  if (unresolved.length === 0) return

  throw new Error(`the bundle list names ${unresolved.join(', ')}, which match no plugin source in the tree`)
}

// A release build ships what enrollment and the store install directly, so an unsigned package inside
// one is not a warning-worthy state the way a dev build's is (bundle-signing.mjs peels a stale
// signature there on purpose): it is a package the app can only ever rate 'unknown', shipped from the
// one place that claims to be the real release. Refuse before packing rather than warn after signing.
// Channel 'dev' is exempt on purpose, so a keyless local build keeps working.
function assertSignedForRelease(channel, signingKey, sources) {
  if (channel !== 'release' || signingKey) return
  const packable = sources.filter((source) => !isCollection(source.manifest))
  if (packable.length === 0) return

  throw new Error(
    `${SIGNING_KEY_VAR} is required to build channel 'release' with ${packable.length} bundled package(s); an unsigned release would ship package(s) the app can only ever rate 'unknown'. Set ${SIGNING_KEY_VAR}, or build with --channel dev for local development.`,
  )
}

// The full monorepo bundle build: discover the release + (channel === 'dev' ? dev : nothing) bundled
// ids plus their dev-only channel variants, pack each into a .b3, assemble the "Bespok3d Official"
// index over the dev build-tags, stage each plugin's doc tree beside the index, and write index.json.
// This is what pack-plugins.sh's build_core delegates to; pruning stale .b3 across repeated
// invocations stays pack-plugins.sh's own concern (unchanged).
export async function buildBundle(request) {
  const { sourceRoot, outputDir, channel, devCuration } = request
  const fsPromises = await import('node:fs/promises')
  const { readFile, readdir, mkdir, stat } = fsPromises
  const path = await import('node:path')
  const { join, dirname } = path
  const url = await import('node:url')
  const { fileURLToPath } = url

  const scriptDir = join(sourceRoot, 'scripts')
  const pluginsRoot = join(sourceRoot, '..', 'plugins')

  const releaseIds = new Set(await readBundleList(readFile, join, scriptDir, 'bundle.json'))
  const devBundle = devCuration ?? await readDevCuration(readFile, join, scriptDir)
  const devIds = channel === 'dev' ? new Set(devBundle.bundle ?? []) : new Set()
  const bundled = new Set([...releaseIds, ...devIds])
  // Taken unconditionally, release channel included: a variant dir's manifest deliberately shares its
  // id with the online atom, so it must never be discovered as that id's SOURCE dir in any channel (see
  // pluginSources' own comment). Only the actual dev-only VARIANT SOURCING below (variantSourcesIn, via
  // B3D_INCLUDE_DEV_BUNDLE) is channel-gated.
  const variantRelDirs = devBundle.variantDirs ?? []
  const variantDirPaths = new Set(variantRelDirs.map((relDir) => join(pluginsRoot, relDir)))

  const idSources = (await pluginSources(readFile, readdir, join, sourceRoot, variantDirPaths)).filter((source) => bundled.has(source.name))
  assertBundleResolved(bundled, idSources)
  if (channel === 'dev') {
    process.env.B3D_INCLUDE_DEV_BUNDLE = '1'
  } else {
    delete process.env.B3D_INCLUDE_DEV_BUNDLE
  }
  const variants = await variantSourcesIn(readFile, stat, join, pluginsRoot, variantRelDirs)
  const sources = [...idSources, ...variants]
  const signingKey = process.env[SIGNING_KEY_VAR]
  assertSignedForRelease(channel, signingKey, sources)

  const ownScriptDir = dirname(fileURLToPath(import.meta.url))
  await mkdir(outputDir, { recursive: true })
  const builder = await importBuilderCore(ownScriptDir, path, url)
  const packages = packSources(builder, sources, outputDir)

  // The publisher is resolved BEFORE anything is stamped or signed, and the same value reaches all three
  // artifacts (the packed manifests, the catalog entries, the index header): a plugin source manifest
  // cannot know which key will sign its release, so it carries a placeholder and the build that signs
  // overwrites it. Stamping precedes signing because the signature covers the manifest bytes it rewrites.
  const publisher = await listPublisher(fsPromises, join, sourceRoot, builder, REGISTRY_PUBLISHER, signingKey)
  stampPublisher(builder, packages, publisher)
  const { peeled } = await signPackages(builder, packages, signingKey)

  const buildTags = await devBuildTags(readdir, readFile, join, idSources, variants, releaseIds, devIds)
  const index = buildIndex(sources.map((source) => ({ ...source.manifest, publisher })), buildTags, publisher)

  await stageDocs(fsPromises, join, outputDir, sources)
  const indexBytes = `${JSON.stringify(index, null, 2)}\n`
  const signed = await writeSignedIndex(fsPromises, join(outputDir, 'index.json'), indexBytes, signingKey, builder)

  return { packages, index, sources, signed, peeled }
}

async function main() {
  const { parseArgs } = await import('node:util')
  const path = await import('node:path')
  const url = await import('node:url')
  const { values } = parseArgs({
    options: {
      source: { type: 'string' },
      out: { type: 'string' },
      channel: { type: 'string' },
    },
  })
  const ownScriptDir = path.dirname(url.fileURLToPath(import.meta.url))
  const sourceRoot = values.source ?? path.dirname(ownScriptDir)
  const outputDir = values.out ?? path.join(sourceRoot, 'dist', 'plugins')
  const channel = values.channel === 'dev' ? 'dev' : 'release'

  const { packages, index, signed, peeled } = await buildBundle({ sourceRoot, outputDir, channel })
  process.stdout.write(`Wrote ${path.join(outputDir, 'index.json')} (${index.plugins.length} plugins, ${index.collections.length} collections); packed ${packages.length} package(s)\n`)
  // An unsigned bundle is a legitimate build state, but a silent one is how a whole build stayed
  // unsigned unnoticed, so every run says which of the two it produced.
  process.stdout.write(signed
    ? `Signed index.json.sig + ${packages.length} package manifest(s) as publisher ${index.publisher}\n`
    : `No ${SIGNING_KEY_VAR}: bundle is UNSIGNED (packages install at trust tier 'unknown'), ${peeled} stale signature(s) removed\n`)
}

if (process.argv[1] && process.argv[1].endsWith('app-bundle.mjs')) {
  main().catch((error) => {
    process.stderr.write(`app-bundle failed: ${error.message}\n`)
    process.exit(1)
  })
}
