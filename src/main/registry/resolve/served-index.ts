// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What turns served bytes into a FetchedRegistry, and what is allowed into the cache. Parsing and
// verification happen HERE and only here, on the fresh path and the cache path alike, so what gets
// verified and what gets used can never be two different things (ADR-0009 publisher tier).
import { RegistryFetchError } from '../model'
import type { RegistryRef, RegistryIndex, ServedIndex, FetchedRegistry } from '../model'
import { writeCache } from './cache'
import type { CacheEntry } from './cache'
import { verifyIndexSignature } from './verify'

// Whether the bytes came off the cache travels WITH them: a caller that assumed 'fresh' would tell the
// user a list had just been re-read when it had not, and the staleness of a list is exactly what the
// user is deciding on. Shared by every transport that resolves bytes before wrapping them.
export interface ResolvedIndex {
  served: ServedIndex
  fromCache: boolean
}

// An unsigned or failing list still loads: what the check found travels whole for the trust layer to
// render as a badge, so a signing mistake costs a wrong badge rather than a dead store.
export async function toFetchedRegistry(ref: RegistryRef, served: ServedIndex, fromCache: boolean): Promise<FetchedRegistry> {
  const index = parseIndex(served.bytes)
  const signature = await verifyIndexSignature(served.bytes, served.signature)

  return { ref, index, fromCache, signature }
}

// A 200 is not proof of an index: a captive portal answers every request with HTML. The failure is a
// transport failure, not a caller's problem, so it arrives as a mapped RegistryFetchError rather than
// a bare SyntaxError nothing downstream knows how to render. Nothing at all is its own answer and not
// an offline machine: a list served as zero bytes reached us fine, and telling the user to check his
// connection sends him to fix something that is not broken.
function parseIndex(bytes: string): RegistryIndex {
  if (bytes.trim().length === 0) throw new RegistryFetchError('empty', 'The list came back empty')
  const parsed = jsonOrTransportFailure(bytes)
  const notAList = whyThisIsNotAPluginList(parsed)
  if (notAList) throw new RegistryFetchError('empty', notAList)

  return parsed as RegistryIndex
}

function jsonOrTransportFailure(bytes: string): unknown {
  try {
    return JSON.parse(bytes)
  } catch {
    throw new RegistryFetchError('network', 'The list did not parse as JSON')
  }
}

// JSON that parsed is still not a plugin list. A source can serve any JSON it likes: the wrong file,
// an error object, a bare number, or a shape built to break the reader. The plugins, the sub-lists and
// the collections are read straight off this object by the walk that loads every source, so a plugins
// field that is not a list threw in the middle of that walk instead of at this source, and one bad
// answer took the whole store down with it: every other list the owner has, gone, over one. Refused
// here, on the single path all three transports parse through, it costs that one source, which is
// dropped with a reason beside its row.
//
// This is the publisher's end, not the machine's, so it is told the way an empty list is told. Only
// the three fields the walk dereferences are demanded; the rest of a list's own description of itself
// is text, and a list missing some of it still loads.
function whyThisIsNotAPluginList(parsed: unknown): string | null {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return 'The list is not in the shape of a plugin list'
  const index = parsed as Partial<RegistryIndex>
  if (!Array.isArray(index.plugins)) return 'The list has no plugins in it'
  if (index.lists !== undefined && !Array.isArray(index.lists)) return 'The list gives its own sub-lists in a shape that cannot be read'
  if (index.collections !== undefined && !Array.isArray(index.collections)) return 'The list gives its own collections in a shape that cannot be read'

  return null
}

// Nothing enters the cache until it has parsed. Caching bytes that do not parse alongside their fresh
// etag would 304 against them forever, so one captive-portal response would leave the source dead
// until the cache file was deleted by hand.
export function cacheServedIndex(cacheKey: string, served: ServedIndex, response: Response): void {
  parseIndex(served.bytes)
  writeCache(cacheKey, { ...served, etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified'), fetchedAt: Date.now() })
}

// A `.sig` read that failed for network reasons was cached as `signature: null` beside a fresh etag, so
// every later fetch 304s against that etag and the list reads 'unknown' forever, even once the network
// recovers, until the publisher happens to edit index.json. Retry the sibling on the way through the
// cache hit and write it back when it arrives.
export async function withRetriedSignature(cacheKey: string, cached: CacheEntry, refetchSignature: () => Promise<string | null>): Promise<CacheEntry> {
  if (cached.signature) return cached
  const signature = await refetchSignature()
  if (!signature) return cached
  const refreshed = { ...cached, signature }
  writeCache(cacheKey, refreshed)

  return refreshed
}
