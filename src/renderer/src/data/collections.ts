// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, ReleaseChannel, TrustTier } from './types'

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

// Resolve member ids to catalog plugins (in the collection's declared order); a member id that matches
// no catalog plugin (not on any enabled source) is set aside as unavailable rather than dropped silently.
function resolveMembers(collection: Collection, plugins: Plugin[]): ResolvedMembers {
  const byId = new Map(plugins.map((plugin) => [plugin.id, plugin]))
  const resolved = collection.members
    .map((member) => byId.get(member.id))
    .filter((plugin): plugin is Plugin => plugin !== undefined)
  const unavailable = collection.members.filter((member) => !byId.has(member.id))

  return { resolved, unavailable }
}

// The catalog plugins a collection installs, in declared order (unresolved members omitted).
export function collectionMembers(collection: Collection, plugins: Plugin[]): Plugin[] {
  return resolveMembers(collection, plugins).resolved
}

export interface MemberSplit {
  installed: Plugin[]
  missing: Plugin[]
  unavailable: CollectionMember[]
}

// Split a collection's members against the printer's installed ids: already-installed members, members
// still to install, and member ids that resolve to no catalog plugin. With no printer (installedIds
// empty) every resolved member is "missing", which is the correct pre-install state.
export function splitMembers(collection: Collection, plugins: Plugin[], installedIds: string[]): MemberSplit {
  const { resolved, unavailable } = resolveMembers(collection, plugins)
  const installedSet = new Set(installedIds)

  return {
    installed: resolved.filter((plugin) => installedSet.has(plugin.id)),
    missing: resolved.filter((plugin) => !installedSet.has(plugin.id)),
    unavailable,
  }
}
