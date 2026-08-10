// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The federated-catalog contract (ADR-0012): the shapes every registry module speaks. The published
// index is a list-of-lists graph of these types; the resolver walks it, merge.ts combines the entries,
// sources.ts derives the Repositories-pane rows, and index.ts does the IO. Declared once here.

// 'unknown' and 'failed' are never declared by a curator - they are what any curated tier derives to
// when nothing proved who served the list (NO-DOWNGRADE: the list still loads, only the badge
// changes). They are two different facts and are kept apart: 'unknown' is a list nobody signed,
// 'failed' is a list that came WITH a signature which did not check out, which is the one an owner
// should look at. 'any' is the exception, because it claims no curation for a signature to stand
// behind.
export type RegistryTrust = 'any' | 'community' | 'project' | 'manufacturer' | 'unknown' | 'failed'

// What the detached signature beside a served index proved about those exact bytes. 'unsigned' is no
// signature at all; 'failed' is a signature that was there and did not check out against the pinned
// key. A caller that only asked for a fingerprint could not tell those two apart, which is why this
// is a value and not a nullable string. Neither outcome blocks the list from loading.
export type SignatureCheck =
  | { proof: 'signed', fingerprint: string }
  | { proof: 'unsigned' }
  | { proof: 'failed' }

// What a PACKAGE's own detached manifest signature proves, which is a different claim from the
// RegistryTrust above and must never be collapsed into it: RegistryTrust vouches for the SOURCE that
// listed a plugin, PackageTrust vouches for the BYTES that were installed. A list can be fully trusted
// and still hand over an unsigned package, and a package signed by an anchored key stays trustworthy
// no matter which list pointed at it. 'unknown' is the NO-DOWNGRADE outcome for a package that carries
// no signature at all; an invalid one is a refusal, never a tier.
export type PackageTrust = 'project' | 'community' | 'unknown'

export interface IndexEntry {
  name: string
  version: string
  [field: string]: unknown
}

export interface RegistryListRef {
  name: string
  url: string
  // Trust is DECLARED by the curating parent (the official main list), not inherited from the
  // referrer: a list the org publishes itself is 'project', a third-party list the org accepts is
  // 'community'. Absent = community (an accepted-but-undeclared external list).
  trust?: RegistryTrust
}

export interface RegistryIndex {
  schema_version: number
  name: string
  publisher: string
  updated: string
  plugins: IndexEntry[]
  // Collections (kind:collection) are install-orchestration meta-packages: a members[] list, no .b3.
  // A published list may omit this entirely (older lists), so it is optional and defaults to empty.
  collections?: IndexEntry[]
  lists: RegistryListRef[]
}

export interface RegistryRef {
  url: string
  trust: RegistryTrust
  locked: boolean
}

// An index exactly as a transport handed it over, plus its detached signature when one was served
// beside it. The bytes are kept verbatim because that is what the signature covers: re-serializing the
// parsed index produces different bytes and would fail verification even for an untampered list.
export interface ServedIndex {
  bytes: string
  signature: string | null
}

export interface FetchedRegistry {
  ref: RegistryRef
  index: RegistryIndex
  fromCache: boolean
  // What the signature beside these bytes proved, carried whole rather than flattened to a nullable
  // fingerprint, so the trust layer can tell an unsigned list from one whose signature failed.
  signature: SignatureCheck
}

export interface MergedEntry extends IndexEntry {
  trust: RegistryTrust
  // Who a signature PROVED published these bytes, in a readable name, null when nobody did. Distinct
  // from the entry's own `publisher` field, which is text the list asserts about itself and which any
  // host of those bytes could write. The store shows this one.
  signer: string | null
  registry_url: string
  // True when this entry is the daemon or an adapter's jinni: the printer's own machinery, which the
  // store may update but never remove. Stamped by main at the renderer boundary (compat/system-packages)
  // from what this build carries, and overwritten on every entry, so a list cannot claim it.
  system_package?: boolean
  // Every source that offers this plugin name, winner-first. Set only on the winner entry (the
  // one shown in the grid); the entries inside carry no further nesting. Drives the detail-view
  // source picker so a developer can see and switch between, e.g., a local build and the
  // published copy of the same plugin.
  variants?: MergedEntry[]
}

// A collection (kind:collection) merged into the catalog: the index entry plus the trust + source the
// resolver stamps from its list ref, exactly like a plugin. Distinct from MergedEntry: a collection
// carries no source `variants` (it is deduped by id in its OWN namespace, never collapsed into a
// source picker) and never reaches `.b3` resolution (it has no download_url; install expands members).
export interface MergedCollection extends IndexEntry {
  trust: RegistryTrust
  signer: string | null
  registry_url: string
}

export interface RegistrySummary {
  url: string
  name: string
  trust: RegistryTrust
  pluginCount: number
  enabled: boolean
  locked: boolean
}

// Why a source could not be loaded, classified so the UI can give an actionable message instead of
// a raw stack: 'auth' = sign in, 'ratelimited' = the host is rationing anonymous reads and signing in
// raises the ration, 'notfound' = gone or no access, 'network' = transport (the machine is offline, and
// signing in fixes nothing), 'signature' = failed verification, 'empty' = the host answered and sent
// nothing (the publisher shipped an empty file, or something in the way replaced it with one),
// 'unknown' = anything else. Kept apart because only some of them are worth offering a sign-in for. A
// fetcher signals one by throwing RegistryFetchError.
export type SourceFailureReason = 'network' | 'auth' | 'ratelimited' | 'notfound' | 'signature' | 'empty' | 'unknown'

export class RegistryFetchError extends Error {
  constructor(
    readonly reason: SourceFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'RegistryFetchError'
  }
}

export interface SourceFailure {
  url: string
  reason: SourceFailureReason
  message: string
}

export interface CatalogResult {
  name: string
  publisher: string
  updated: string
  trust: RegistryTrust
  plugins: MergedEntry[]
  collections: MergedCollection[]
  registries: RegistrySummary[]
  drops: string[]
  failures: SourceFailure[]
}

export interface ResolveLimits {
  maxDepth: number
  maxRegistries: number
  maxEntries: number
}

export type RegistryFetcher = (ref: RegistryRef) => Promise<FetchedRegistry | null>

export const DEFAULT_LIMITS: ResolveLimits = { maxDepth: 8, maxRegistries: 100, maxEntries: 5000 }

// A list reference that declares no trust falls here: it was accepted into a parent list but the
// curator left it unmarked, so it gets the lowest curated tier rather than the parent's.
export const UNDECLARED_TRUST: RegistryTrust = 'community'
