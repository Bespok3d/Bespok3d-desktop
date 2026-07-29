// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure federated-catalog resolver. The published index is a list-of-lists graph (ADR-0012), so
// loading it is a guarded traversal: fetch each registry at most once, bound depth and fan-out,
// isolate per-registry failures, and hand the gathered entries to merge.ts to dedupe + collapse.
// All IO is injected as `fetcher`, so this core is unit-testable without touching disk or network.
// The bundled official list is just one root whose source is a disk path; remote roots drop into the
// same flow once GPG verification lands.
import type {
  CatalogResult,
  FetchedRegistry,
  IndexEntry,
  MergedCollection,
  MergedEntry,
  RegistryFetcher,
  RegistryRef,
  RegistrySummary,
  RegistryTrust,
  ResolveLimits,
  SourceFailure,
  SourceFailureReason,
} from '../model'
import { RegistryFetchError, UNDECLARED_TRUST } from '../model'
import { normalizeRegistryUrl } from './url'
import { provedSigner } from './verify'
import { collapseToVariants, dedupeCollections, resolveCrossSourceDeps } from './merge'

interface ResolveState {
  limits: ResolveLimits
  log: (message: string) => void
  visited: Set<string>
  fetched: FetchedRegistry[]
  entries: MergedEntry[]
  collections: MergedCollection[]
  drops: string[]
  failures: SourceFailure[]
}

function classifyFetchError(error: Error): SourceFailureReason {
  return error instanceof RegistryFetchError ? error.reason : 'unknown'
}

// A tier is what a curator CLAIMS a source is, and a claim is worth the signature behind it: without
// one, anybody who can serve those bytes can call themselves the project. So a curated tier survives
// only when a signature over the served bytes checked out, and otherwise reads 'unknown'. The list
// still loads either way (NO-DOWNGRADE): an unproved source costs a badge, never an install. Trust
// 'any' claims no curation to prove, so it passes through unchanged; that is the user's own
// sideloaded files, which nobody ever vouched for and which the badge already says so about.
function derivedTrust(ref: RegistryRef, signedBy: string | null): RegistryTrust {
  if (ref.trust === 'any') return 'any'
  if (signedBy === null) return 'unknown'

  return ref.trust
}

// `signer` is who a signature PROVED published these bytes, as opposed to the entry's own `publisher`
// field, which is a line of text inside the list saying whatever the list says. The store shows the
// proved name and drops the claimed one, so a badge can never name a publisher nobody checked.
function toMerged(entry: IndexEntry, registry: FetchedRegistry): MergedEntry {
  return {
    ...entry,
    trust: derivedTrust(registry.ref, registry.signedBy),
    signer: provedSigner(registry.signedBy),
    registry_url: registry.ref.url,
  }
}

function toSummary(registry: FetchedRegistry): RegistrySummary {
  return {
    url: registry.ref.url,
    name: registry.index.name,
    trust: registry.ref.trust,
    pluginCount: registry.index.plugins.length,
    enabled: true,
    locked: registry.ref.locked,
  }
}

// A sub-list carries the trust the parent declared for it (org-published -> project, accepted
// third-party -> community), NOT the parent's own trust: being referenced by the project index does
// not make an external list project. Undeclared falls to the lowest curated tier.
function childRefs(registry: FetchedRegistry): RegistryRef[] {
  return (registry.index.lists ?? []).map((ref) => ({ url: ref.url, trust: ref.trust ?? UNDECLARED_TRUST, locked: false }))
}

function absorbEntries(state: ResolveState, registry: FetchedRegistry): void {
  const room = Math.max(0, state.limits.maxEntries - state.entries.length)
  const incoming = registry.index.plugins
  const taken = incoming.slice(0, room)
  taken.forEach((entry) => state.entries.push(toMerged(entry, registry)))
  if (taken.length < incoming.length) {
    state.drops.push(`max-entries: dropped ${incoming.length - taken.length} entries from ${registry.ref.url}`)
    state.log(`max-entries reached, dropped ${incoming.length - taken.length} entries from ${registry.ref.url}`)
  }
}

// Collections ride the same toMerged trust-stamping as plugins but live in their own list, kept apart
// from the plugin entries so they never enter collapseToVariants (a collection has no source picker)
// and never reach `.b3` resolution. A list that ships none simply contributes nothing here.
function absorbCollections(state: ResolveState, registry: FetchedRegistry): void {
  ;(registry.index.collections ?? []).forEach((entry) => state.collections.push(toMerged(entry, registry)))
}

async function fetchOne(state: ResolveState, ref: RegistryRef, fetcher: RegistryFetcher): Promise<FetchedRegistry | null> {
  const fetched = await fetcher(ref).catch((error: Error) => {
    state.failures.push({ url: ref.url, reason: classifyFetchError(error), message: error.message })
    state.drops.push(`fetch failed: ${ref.url} (${error.message})`)
    state.log(`skipped ${ref.url}: ${error.message}`)

    return null
  })
  if (!fetched) return null
  state.fetched.push(fetched)
  absorbEntries(state, fetched)
  absorbCollections(state, fetched)

  return fetched
}

function withinRegistryCap(state: ResolveState, fresh: RegistryRef[]): RegistryRef[] {
  const room = Math.max(0, state.limits.maxRegistries - state.fetched.length)
  const allowed = fresh.slice(0, room)
  if (allowed.length < fresh.length) {
    state.drops.push(`max-registries: dropped ${fresh.length - allowed.length} registries`)
    state.log(`max-registries reached, dropped ${fresh.length - allowed.length} registries`)
  }

  return allowed
}

async function expandLevel(state: ResolveState, frontier: RegistryRef[], depth: number, fetcher: RegistryFetcher): Promise<ResolveState> {
  if (frontier.length === 0) return state
  if (depth > state.limits.maxDepth) {
    state.drops.push(`max-depth: dropped ${frontier.length} registries at depth ${depth}`)

    return state
  }
  const fresh = frontier.filter((ref) => !state.visited.has(normalizeRegistryUrl(ref.url)))
  const allowed = withinRegistryCap(state, fresh)
  allowed.forEach((ref) => state.visited.add(normalizeRegistryUrl(ref.url)))
  const fetched = (await Promise.all(allowed.map((ref) => fetchOne(state, ref, fetcher)))).filter(Boolean) as FetchedRegistry[]

  return expandLevel(state, fetched.flatMap(childRefs), depth + 1, fetcher)
}

export async function resolveCatalog(roots: RegistryRef[], fetcher: RegistryFetcher, limits: ResolveLimits, log: (message: string) => void): Promise<CatalogResult> {
  const state: ResolveState = { limits, log, visited: new Set(), fetched: [], entries: [], collections: [], drops: [], failures: [] }
  await expandLevel(state, roots, 0, fetcher)
  const primary = state.fetched[0]

  return {
    name: primary?.index.name ?? 'Catalog',
    publisher: primary?.index.publisher ?? '',
    updated: primary?.index.updated ?? '',
    trust: roots[0]?.trust ?? UNDECLARED_TRUST,
    plugins: resolveCrossSourceDeps(collapseToVariants(state.entries)),
    collections: dedupeCollections(state.collections),
    registries: state.fetched.map(toSummary),
    drops: state.drops,
    failures: state.failures,
  }
}
