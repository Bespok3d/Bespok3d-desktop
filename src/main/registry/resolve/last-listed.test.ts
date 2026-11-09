// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A list that fails to load must still say what it hides, and the only honest source for that is the
// last good copy, read back through the same parse path as any cache hit.
import { describe, it, expect, vi } from 'vitest'
import { RegistryFetchError } from '../model'
import type { RegistryRef } from '../model'
import type { CacheEntry } from './cache'
import { lastListedNames, withLastListed } from './last-listed'

const mocks = vi.hoisted(() => ({ cache: new Map<string, unknown>() }))

// Mocking these with factories keeps ../../app-paths (and with it electron) out of the run.
vi.mock('./cache', () => ({ loadCache: () => mocks.cache, writeCache: vi.fn() }))
vi.mock('./verify', () => ({ verifyIndexSignature: () => Promise.resolve({ proof: 'unsigned' }) }))

const LIST_URL = 'https://lists.example.invalid/index.json'
const REF: RegistryRef = { url: LIST_URL, trust: 'community', locked: false }
const CACHED_BYTES = JSON.stringify({
  schema_version: 1, name: 'Example List', publisher: 'Example', updated: '2026-01-01', lists: [],
  plugins: [{ name: 'camera', title: 'Camera', version: '1.0.0' }, { name: 'spool-tracker', version: '1.0.0' }],
})

function cachedEntry(bytes: string): CacheEntry {
  return { key: LIST_URL, bytes, signature: null, etag: null, lastModified: null, fetchedAt: 0 }
}

function withCache(entries: Array<[string, CacheEntry]>): void {
  mocks.cache = new Map(entries)
}

describe('lastListedNames', () => {
  it('gives the plugin names the last good copy listed, title first', async () => {
    withCache([[LIST_URL, cachedEntry(CACHED_BYTES)]])
    expect(await lastListedNames(REF)).toEqual(['Camera', 'spool-tracker'])
  })

  it('gives null when no copy of the list was ever saved', async () => {
    withCache([])
    expect(await lastListedNames(REF)).toBeNull()
  })

  it('gives null when the saved copy does not parse as a list', async () => {
    withCache([[LIST_URL, cachedEntry('<html>captive portal</html>')]])
    expect(await lastListedNames(REF)).toBeNull()
  })
})

describe('withLastListed', () => {
  it('rethrows a list failure carrying the names of the last good copy', async () => {
    withCache([[LIST_URL, cachedEntry(CACHED_BYTES)]])
    const thrown = await withLastListed(REF, new RegistryFetchError('network', 'offline')).catch((error: RegistryFetchError) => error)
    expect(thrown).toMatchObject({ reason: 'network', message: 'offline', lastListed: ['Camera', 'spool-tracker'] })
  })

  it('lets an error that is not a list failure travel up untouched', async () => {
    const bug = new TypeError('a bug in this app')
    await expect(withLastListed(REF, bug)).rejects.toBe(bug)
  })
})
