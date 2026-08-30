// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { isNewerVersion } from '@bespok3d/contract'
import type { MigrationEntry, MigrationTerms, Plugin, ReleaseChannel, TrustTier } from './types'

// One member of a collection: a plugin id and the version range the collection was authored against.
export interface CollectionMember {
  id: string
  version?: string
}

// Wire shape of one collection in the federated index (snake_case), enriched by the resolver with
// `trust` + `registry_url`, exactly like IndexEntry for plugins. Carries `members` and no install/
// dependency fields. The loader (shape.ts) maps this to the camelCase `Collection` below.
export interface CollectionEntry {
  name: string
  title: string
  version: string
  description: string
  tagline: string
  category: string
  channel: ReleaseChannel
  publisher: string
  author?: string
  printer_specific: boolean
  published_at: string
  updated_at: string
  members: CollectionMember[]
  migration?: MigrationEntry
  doc_url: string
  trust: TrustTier
  signer?: string | null
  registry_url: string
  changelog_url?: string
  license_url?: string
  attributions?: string
  icon?: string
  homepage?: string
}

// A collection (kind:collection): a curated set of plugins installed together. A DISTINCT type, not a
// Plugin flavor - members are a separate list, NEVER `Plugin.deps` (deps are reference-counted +
// cascade-uninstalled; membership is neither). A collection has no `.b3`, no install/uninstall state of
// its own; "Install all" expands `members` through the normal batch-install path. Resolved from a
// distinct `collections[]` so it never reaches `.b3` resolution.
export interface Collection {
  id: string
  name: string
  title: string
  category: string
  tagline: string
  description: string
  version: string
  channel: ReleaseChannel
  publisher: string
  author?: string
  signer: string | null
  trust: TrustTier
  members: CollectionMember[]
  migration?: MigrationTerms
  printerSpecific?: boolean
  publishedAt?: string
  updatedAt?: string
  homepage?: string
  icon?: string
  doc?: string
  changelog?: string
  // Where the README and the release notes of the offered version can be read at runtime, when the
  // publisher released them with that version.
  docUrl?: string
  changelogUrl?: string
  // True when this collection came from the local bundled dev index rather than a published list.
  local?: boolean
}

// Pure member resolution for a collection. This is what the collection tile, the detail modal, and the
// install-all flow all consume: it answers "which member plugins exist in the catalog, and of those
// which are already installed vs still missing". It is NOT dependency logic (membership is not a dep),
// so it lives here in data/, not in data/deps/.

interface ResolvedMembers {
  resolved: Plugin[]
  unavailable: CollectionMember[]
}

// One member expanded: a plugin id resolves to that plugin; an id that names another catalog
// collection expands to THAT collection's plugins (recursively, so a pack may bundle a pack); an id
// matching neither, or a membership cycle, is set aside as unavailable rather than dropped silently.
function expandMember(
  member: CollectionMember,
  pluginsById: Map<string, Plugin>,
  collectionsById: Map<string, Collection>,
  visitedCollectionIds: ReadonlySet<string>,
): ResolvedMembers {
  const memberPlugin = pluginsById.get(member.id)
  if (memberPlugin) return { resolved: [memberPlugin], unavailable: [] }
  const nestedCollection = collectionsById.get(member.id)
  if (!nestedCollection || visitedCollectionIds.has(member.id)) {
    return { resolved: [], unavailable: [member] }
  }

  return expandCollection(nestedCollection, pluginsById, collectionsById, visitedCollectionIds)
}

// Membership is a shallow tree (a pack naming a pack), so bounded recursion with a visited set is the
// right shape; the visited set turns any authoring cycle into "unavailable" instead of a hang.
function expandCollection(
  collection: Collection,
  pluginsById: Map<string, Plugin>,
  collectionsById: Map<string, Collection>,
  visitedCollectionIds: ReadonlySet<string>,
): ResolvedMembers {
  const visited = new Set([...visitedCollectionIds, collection.id])
  const expansions = collection.members.map((member) =>
    expandMember(member, pluginsById, collectionsById, visited),
  )

  return {
    resolved: expansions.flatMap((expansion) => expansion.resolved),
    unavailable: expansions.flatMap((expansion) => expansion.unavailable),
  }
}

// A plugin reached through two members (directly and via a nested collection) installs once: keep the
// first occurrence, which preserves the collection's declared order.
function dedupeByPluginId(plugins: Plugin[]): Plugin[] {
  const seenIds = new Set<string>()

  return plugins.filter((plugin) => {
    if (seenIds.has(plugin.id)) return false
    seenIds.add(plugin.id)

    return true
  })
}

// Resolve member ids to catalog plugins (in the collection's declared order), flattening members that
// are themselves collections; an id resolving to neither is unavailable, never dropped silently.
function resolveMembers(collection: Collection, plugins: Plugin[], collections: Collection[]): ResolvedMembers {
  const pluginsById = new Map(plugins.map((plugin) => [plugin.id, plugin]))
  const collectionsById = new Map(collections.map((catalogCollection) => [catalogCollection.id, catalogCollection]))
  const expanded = expandCollection(collection, pluginsById, collectionsById, new Set())

  return { resolved: dedupeByPluginId(expanded.resolved), unavailable: expanded.unavailable }
}

// The catalog plugins a collection installs, in declared order (unresolved members omitted).
export function collectionMembers(collection: Collection, plugins: Plugin[], collections: Collection[]): Plugin[] {
  return resolveMembers(collection, plugins, collections).resolved
}

export interface MemberSplit {
  installed: Plugin[]
  missing: Plugin[]
  unavailable: CollectionMember[]
}

// Split a collection's members against the printer's installed ids: already-installed members, members
// still to install, and member ids that resolve to no catalog plugin. With no printer (installedIds
// empty) every resolved member is "missing", which is the correct pre-install state.
export function splitMembers(
  collection: Collection,
  plugins: Plugin[],
  collections: Collection[],
  installedIds: string[],
): MemberSplit {
  const { resolved, unavailable } = resolveMembers(collection, plugins, collections)
  const installedSet = new Set(installedIds)

  return {
    installed: resolved.filter((plugin) => installedSet.has(plugin.id)),
    missing: resolved.filter((plugin) => !installedSet.has(plugin.id)),
    unavailable,
  }
}

// A plugin can retire into a collection under the same id (klipper-motion was a patch plugin through
// 0.1.3; since 0.1.4 the base layer owns the patching and the id names a collection). An installed
// plugin whose id is now a catalog collection marks that collection as carrying a migration.
export function pluginBecameCollection(collection: Collection, installedIds: string[]): boolean {
  return installedIds.includes(collection.id)
}

export function becameCollectionIds(collections: Collection[], installedIds: string[]): string[] {
  return collections
    .filter((collection) => pluginBecameCollection(collection, installedIds))
    .map((collection) => collection.id)
}

// The terms of the version that is actually being sent, not of the catalog row that won the merge.
// One plugin id can be listed by several sources and the store shows one row for it; the version that
// changes what the plugin does is not always the one that row came from, so reading the row alone
// turns a change of shape into an ordinary update. The row's own terms stay the answer for a plugin
// whose source was never recorded.
export function offeredMigrationTerms(plugin: Plugin, sourceUrl: string | undefined): MigrationTerms | undefined {
  const offeredSource = plugin.sources.find((source) => source.registryUrl === sourceUrl)

  return offeredSource?.migration ?? plugin.migration
}

function notOlderThan(floor: string | undefined, installedVersion: string): boolean {
  return !floor || installedVersion === floor || isNewerVersion(installedVersion, floor)
}

// The printer is already carrying the version the new shape arrived in, so the move is behind it.
function alreadyMoved(untilVersion: string | undefined, installedVersion: string): boolean {
  return !!untilVersion && notOlderThan(untilVersion, installedVersion)
}

// Whether the copy actually on this printer is one the declared move covers. No declared `fromVersion`
// covers every installed version; a declared one narrows it to that version and everything after it, so
// a printer left on an older build is not swept into a move that was never written for it. `untilVersion`
// closes the other end: it names the version the new shape arrives in, so a printer that has already
// made the move reads its next update as an ordinary update rather than being walked through it again.
export function migrationCovers(terms: MigrationTerms | undefined, installedVersion: string | undefined): boolean {
  if (!installedVersion) return true

  return notOlderThan(terms?.fromVersion, installedVersion) && !alreadyMoved(terms?.untilVersion, installedVersion)
}
