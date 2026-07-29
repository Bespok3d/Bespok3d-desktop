// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { writeFileSync } from 'fs'
import { readJsonFile } from '../../json-store'
import { userDataPath } from '../../app-paths'
import type { ServedIndex } from '../model'

// The client-side registry cache: one entry per fetched url with its HTTP validators, so a remote
// list re-fetch is a conditional GET (a 304 reuses the stored bytes instead of re-crunching the
// subtree). Kept in memory after first read and mirrored to userData; corrupt cache falls back to
// empty (json-store) and simply re-fetches.
//
// It stores the RAW SERVED BYTES and the detached signature, never a parsed index and never a
// verification verdict. A stored verdict would be a trust bypass: anything that can edit this file
// could hand itself a trusted badge. Every cache hit re-verifies the bytes from scratch.
// `key` repeats the map key on purpose: it binds these bytes to the url they were served from.
// Without it, anything able to edit the cache file could file the org-signed official index under
// another list's key, and that list would render with the official badge over content it never
// served. Re-verification cannot catch that, the bytes really are signed.
export interface CacheEntry extends ServedIndex {
  key: string
  etag: string | null
  lastModified: string | null
  fetchedAt: number
}

const cacheStore: { map: Map<string, CacheEntry> | null } = { map: null }

function cachePath(): string {
  return userDataPath('registry-cache.json')
}

// Entries written before the cache kept raw bytes hold only a parsed index, which can never be
// re-verified against a signature. Drop them on load so the next fetch re-reads the bytes rather than
// the app trusting a copy it cannot check. An entry whose stored key disagrees with the key it sits
// under was moved by something other than this module, and goes the same way (legacy entries, which
// carry no key at all, are dropped by the same test).
function isVerifiable([cacheKey, entry]: [string, CacheEntry]): boolean {
  return typeof entry?.bytes === 'string' && entry.key === cacheKey
}

export function loadCache(): Map<string, CacheEntry> {
  if (cacheStore.map) return cacheStore.map
  const fromDisk = readJsonFile<Array<[string, CacheEntry]>>(cachePath(), [])
  cacheStore.map = new Map(fromDisk.filter(isVerifiable))

  return cacheStore.map
}

// The binding is stamped here rather than accepted from the caller: a caller passing the wrong key
// IS the bug this guards against, so there is nothing for one to get right.
export function writeCache(url: string, entry: Omit<CacheEntry, 'key'>): void {
  const map = loadCache()
  map.set(url, { ...entry, key: url })
  writeFileSync(cachePath(), JSON.stringify([...map.entries()]))
}

export function conditionalHeaders(cached: CacheEntry | undefined): Record<string, string> {
  const headers: Record<string, string> = {}
  if (cached?.etag) headers['If-None-Match'] = cached.etag
  if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified

  return headers
}
