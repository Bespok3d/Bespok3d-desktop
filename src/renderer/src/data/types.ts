// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The Collection concept (its domain type, wire entry, member type, and resolution helpers) lives in
// one cohesive module, data/collections.ts; CatalogPayload below carries the wire entries.
import type { CollectionEntry } from './collections'
import type { PluginConfigField, IndexConfigField } from './plugin-config'
import type { RegistryTrust } from '../../../main/registry/model'

// The renderer's name for the trust a SOURCE was granted. It is an alias, not a copy: the list of
// tiers is declared once, where the registry decides them (main/registry/model.ts), so a tier added
// there cannot go missing here. The renderer receives the tier as a plain string over IPC, which is
// exactly why nothing would fail on a divergence if the two lists were written out twice.
export type TrustTier = RegistryTrust
export type ReleaseChannel = 'lts' | 'stable' | 'rc' | 'testing' | 'experiment'

// The printer identity, its connection-ladder reading, and the enrollment log live in one cohesive
// module, data/printer.ts (same split-by-concern pattern as collections.ts and plugin-config.ts);
// re-exported here so importers keep a single data/types entry point.
export type { EnrollmentLogStep, EnrollmentLog, Printer, ConnectionReach, PrinterConnection } from './printer'
export type { DriftReport } from '@bespok3d/contract'

export interface PluginMacro {
  name: string
  description: string
  params?: string
}

export type { PluginConfigType, PluginConfigScope, PluginConfigField, IndexConfigField } from './plugin-config'

export interface PluginEndpoint {
  label: string
  path: string
}

// One source that offers a plugin (the detail-view source picker iterates these). `label` is the
// source's human name (e.g. "Bespok3d Official" or "bundled offline copy"); `installed` marks the
// source the printer's current copy came from, when known.
export interface PluginSource {
  registryUrl: string
  label: string
  version: string
  // The packaged upstream version this variant ships, when it wraps an external project (e.g. Fluidd
  // 1.37.2). Absent for a plugin that wraps nothing. Shown as the primary version, plugin version in
  // brackets.
  swVersion?: string
  // The release channel this specific variant publishes. One plugin id can appear on the same
  // source at several channels, so a variant's identity is registryUrl x channel, not registryUrl
  // alone. Drives the ceiling-based pick (data/channels.ts) and the Versions-tab channel selector.
  channel: ReleaseChannel
  trust: TrustTier
  local: boolean
  publishedAt?: string
  downloadUrl?: string
  installed?: boolean
}

// Marks a plugin whose running service writes a log we can tail and surface in the Captured tab.
// Both fields optional: a managed-service plugin gets an empty `{}` (default to the wrapper log,
// capture URLs); `path` overrides the source, `captures` adds named regex patterns beyond URLs.
export interface PluginLog {
  path?: string
  captures?: Record<string, string>
}

export interface Plugin {
  id: string
  name: string
  title: string
  category: string
  tagline: string
  description: string
  version: string
  // The packaged upstream version, when this plugin wraps an external project. Shown as the primary
  // version with the plugin version in brackets; absent for a plugin that wraps nothing.
  swVersion?: string
  channel: ReleaseChannel
  publisher: string
  // The human/org display name that authored this plugin. Distinct from `publisher` (the signing-key
  // fingerprint that PROVES it): the author and the key that signs may differ, and only the signature
  // is proof.
  author?: string
  // Who a signature PROVED published the list this came from; null when nobody did, and the store then
  // shows nothing rather than repeating the unchecked claim `publisher` above makes.
  signer: string | null
  trust: TrustTier
  deps: string[]
  conflicts: string[]
  printerSpecific?: boolean
  endpoints?: PluginEndpoint[]
  config?: PluginConfigField[]
  minDaemonVersion?: string
  publishedAt?: string
  updatedAt?: string
  homepage?: string
  doc?: string
  changelog?: string
  // Where the README and the release notes of the offered version can be read at runtime. Present only
  // when the publisher released them with that version; the bundled copy above is what shows without it.
  docUrl?: string
  changelogUrl?: string
  macros?: PluginMacro[]
  log?: PluginLog
  // True when this entry came from the local bundled dev index rather than a published list. Only
  // happens in dev builds; the UI badges it so a developer can tell local plugins from listed ones.
  local?: boolean
  // Every source offering this plugin (winner first). length > 1 means the same plugin is on more
  // than one source (e.g. local dev + published); the detail view lets the user pick which to use.
  sources: PluginSource[]
}


// Wire shape of one plugin in the federated index (snake_case on disk, ADR-0012), enriched by
// the main-process resolver with the source registry's `trust` and `registry_url`. The loader
// maps this to the camelCase `Plugin` at exactly one boundary (data/catalog.ts).
export interface IndexEntry {
  name: string
  title: string
  version: string
  sw_version?: string
  description: string
  tagline: string
  category: string
  channel: ReleaseChannel
  publisher: string
  author?: string
  printer_specific: boolean
  published_at: string
  updated_at: string
  requires: { capabilities: string[] }
  provides: string[]
  deps: string[]
  conflicts: string[]
  doc_url: string
  download_url: string
  trust: TrustTier
  // Absent on a published list: the resolver stamps it after checking the signature over the bytes.
  signer?: string | null
  registry_url: string
  endpoints?: PluginEndpoint[]
  changelog_url?: string
  icon?: string
  min_daemon_version?: string
  homepage?: string
  macros?: PluginMacro[]
  config?: IndexConfigField[]
  log?: PluginLog
  // Every source offering this plugin name, winner first; set only on the winner entry by the
  // resolver. The renderer maps these to Plugin.sources.
  variants?: IndexEntry[]
}

export interface RegistrySummary {
  url: string
  name: string
  trust: TrustTier
  pluginCount: number
  enabled: boolean
  locked: boolean
}

export type SourceStatus = 'ok' | 'failed' | 'disabled'
// Why a source failed to load, so the pane can show an actionable hint (e.g. sign in) rather than a
// raw error. Mirrors the main-process SourceFailureReason; null when the source is ok or disabled.
export type SourceFailureReason = 'network' | 'auth' | 'ratelimited' | 'notfound' | 'signature' | 'empty' | 'unknown'

// One row in the Repositories pane: a configured plugin source with its real state. `label` is the
// human-readable id (a github coordinate or "bundled"), `name` the catalog title.
export interface SourceRow {
  url: string
  label: string
  name: string
  trust: TrustTier
  locked: boolean
  enabled: boolean
  status: SourceStatus
  pluginCount: number
  error: string | null
  reason: SourceFailureReason | null
}

export interface CatalogPayload {
  name: string
  publisher: string
  updated: string
  trust: TrustTier
  plugins: IndexEntry[]
  // Collections (kind:collection) ride the same wire as plugins but in a separate array; the loader
  // maps them to the camelCase `Collection` type. A collection entry's wire shape carries `members`.
  collections: CollectionEntry[]
  registries: RegistrySummary[]
  sources: SourceRow[]
  drops: string[]
}

// One sideloaded (drag-dropped) package after ingest. `metadataComplete` is false when catalog fields
// (title/description/tagline/category/channel) are missing, so the UI can hint without rejecting it.
export interface LocalPackageInfo {
  id: string
  version: string
  title: string
  metadataComplete: boolean
}

export interface AddLocalResult {
  added: LocalPackageInfo[]
  errors: { file: string; message: string }[]
}

export interface Category {
  id: string
  title: string
  sub: string
  icon: string
}

export interface Repository {
  id: string
  name: string
  url: string
  trust: TrustTier
  enabled: boolean
  locked: boolean
  lastSync: string
  pluginCount: number
  note: string
}

export interface Channel {
  id: ReleaseChannel
  label: string
  short: string
  description: string
  cadence: string
  tone: string
  defaultOn: boolean
}

export interface PrinterAdapter {
  id: string
  title: string
  vendor: string
  version: string
  channel: ReleaseChannel
  trust: TrustTier
  description: string
}
