// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The store must fill for someone with no GitHub account at all. It did not: every list ref went to
// the contents API first, which rations an anonymous caller to 60 requests an hour per IP, so the
// third catalog load of the day was answered 403 and the store rendered empty. These tests pin the
// ladder that replaced it - release asset, then raw file, then the API only for someone signed in -
// and pin that a dead ladder keeps the failure the user can act on instead of flattening it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { RegistryRef } from '../model'
import type { CacheEntry } from './cache'
import { fetchGitHostRegistry } from './fetch'

const mocks = vi.hoisted(() => ({ entries: new Map<string, CacheEntry>(), writeCache: vi.fn(), verifyIndexSignature: vi.fn(), getFile: vi.fn(), listReleases: vi.fn(), isConnected: vi.fn() }))

// Mocking ./cache with a factory also keeps ../../app-paths (and with it electron) out of the run.
vi.mock('./cache', () => ({
  loadCache: () => mocks.entries,
  writeCache: mocks.writeCache,
  conditionalHeaders: (cached: CacheEntry | undefined) => (cached?.etag ? { 'if-none-match': cached.etag } : {}),
}))
vi.mock('./verify', () => ({ verifyIndexSignature: mocks.verifyIndexSignature }))
vi.mock('../../git-host', () => ({
  activeConnector: () => ({ getFile: mocks.getFile, listReleases: mocks.listReleases, isConnected: mocks.isConnected }),
}))

const LIST_OWNER = 'bespok3d-fixture'
const LIST_REPO = 'list-repo'
const GITHUB_SCHEME_URL = `github:${LIST_OWNER}/${LIST_REPO}/index.json`
const RELEASE_ASSET_URL = `https://github.com/${LIST_OWNER}/${LIST_REPO}/releases/latest/download/index.json`
const RAW_FILE_URL = `https://raw.githubusercontent.com/${LIST_OWNER}/${LIST_REPO}/main/index.json`
const RATION_SPENT = { 'x-ratelimit-remaining': '0' }
const CACHED_ETAG = 'W/"fixture-etag"'
const FIXTURE_BYTES = `${JSON.stringify({ schema_version: 1, name: 'Fixture List', publisher: 'PLACEHOLDER', updated: '2026-01-01', plugins: [] })}\n`
const REPUBLISHED_BYTES = FIXTURE_BYTES.replace('Fixture List', 'Republished List')

interface ServedAnswer {
  status: number
  body: string
  headers: Record<string, string>
}

interface HttpProbe {
  requested: string[]
  headersSent: Record<string, string>[]
}

function answer(status: number, body: string, headers: Record<string, string> = {}): ServedAnswer {
  return { status, body, headers }
}

const NOT_ON_THIS_AVENUE = answer(404, '')

// Every url the ladder can try is answered here, so what a test does NOT list is a 404 rather than a
// silent hole, and the probe records what was asked and with which headers.
function servedBy(routes: Record<string, ServedAnswer>): HttpProbe {
  const probe: HttpProbe = { requested: [], headersSent: [] }
  vi.stubGlobal('fetch', (url: string, init: { headers?: Record<string, string> }) => {
    probe.requested.push(url)
    probe.headersSent.push(init.headers ?? {})
    const served = routes[url] ?? NOT_ON_THIS_AVENUE

    return Promise.resolve({ ok: served.status >= 200 && served.status < 300, status: served.status, text: () => Promise.resolve(served.body), headers: new Headers(served.headers) })
  })

  return probe
}

function refusingEveryConnection(): HttpProbe {
  const probe: HttpProbe = { requested: [], headersSent: [] }
  vi.stubGlobal('fetch', (url: string) => {
    probe.requested.push(url)

    return Promise.reject(new TypeError('fetch failed'))
  })

  return probe
}

function refTo(url: string): RegistryRef {
  return { url, trust: 'project', locked: true }
}

function askedTheApi(probe: HttpProbe): boolean {
  return probe.requested.some((url) => url.includes('api.github.com'))
}

function seedCache(url: string): void {
  mocks.entries.set(url, { key: url, bytes: FIXTURE_BYTES, signature: null, etag: CACHED_ETAG, lastModified: null, fetchedAt: 1 })
}

beforeEach(() => {
  mocks.entries.clear()
  mocks.verifyIndexSignature.mockResolvedValue({ proof: 'unsigned' })
  mocks.getFile.mockResolvedValue(null)
  mocks.isConnected.mockReset().mockResolvedValue(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('a published list loads for someone with no GitHub account', () => {
  it('reads the release asset and spends no API request doing it', async () => {
    const probe = servedBy({ [RELEASE_ASSET_URL]: answer(200, FIXTURE_BYTES) })
    const fetched = await fetchGitHostRegistry(refTo(RELEASE_ASSET_URL))

    expect(fetched.index.name).toBe('Fixture List')
    expect(askedTheApi(probe)).toBe(false)
  })

  it('sends a github: ref down the same ladder instead of to the API', async () => {
    const probe = servedBy({ [RELEASE_ASSET_URL]: answer(200, FIXTURE_BYTES) })
    const fetched = await fetchGitHostRegistry(refTo(GITHUB_SCHEME_URL))

    expect(fetched.index.name).toBe('Fixture List')
    expect(probe.requested).toContain(RELEASE_ASSET_URL)
    expect(askedTheApi(probe)).toBe(false)
    expect(mocks.getFile).not.toHaveBeenCalled()
  })

  it('falls through a list no release publishes to the file on main', async () => {
    const probe = servedBy({ [RAW_FILE_URL]: answer(200, FIXTURE_BYTES) })
    const fetched = await fetchGitHostRegistry(refTo(GITHUB_SCHEME_URL))

    expect(fetched.index.name).toBe('Fixture List')
    expect(probe.requested.indexOf(RELEASE_ASSET_URL)).toBeLessThan(probe.requested.indexOf(RAW_FILE_URL))
  })

  it('carries no Authorization header on either anonymous avenue, signed in or not', async () => {
    mocks.isConnected.mockResolvedValue(true)
    const probe = servedBy({ [RAW_FILE_URL]: answer(200, FIXTURE_BYTES) })
    await fetchGitHostRegistry(refTo(GITHUB_SCHEME_URL))

    expect(probe.headersSent.length).toBeGreaterThan(0)
    expect(probe.headersSent.every((headers) => !Object.keys(headers).some((name) => name.toLowerCase() === 'authorization'))).toBe(true)
  })
})

describe('a ladder that serves nothing keeps the failure the user can act on', () => {
  it('calls a spent request ration what it is, not a sign-in problem', async () => {
    servedBy({ [RELEASE_ASSET_URL]: answer(403, '', RATION_SPENT), [RAW_FILE_URL]: answer(403, '', RATION_SPENT) })

    await expect(fetchGitHostRegistry(refTo(GITHUB_SCHEME_URL))).rejects.toMatchObject({ reason: 'ratelimited' })
  })

  it('reports a list that is nowhere as not found, so the message can offer the sign-in that reaches it', async () => {
    servedBy({})

    await expect(fetchGitHostRegistry(refTo(GITHUB_SCHEME_URL))).rejects.toMatchObject({ reason: 'notfound' })
  })

  it('reports an unreachable host as a network failure, which no sign-in fixes', async () => {
    refusingEveryConnection()

    await expect(fetchGitHostRegistry(refTo(RELEASE_ASSET_URL))).rejects.toMatchObject({ reason: 'network' })
  })

  it('prefers the spent ration over a plain miss when the avenues disagree', async () => {
    servedBy({ [RAW_FILE_URL]: answer(403, '', RATION_SPENT) })

    await expect(fetchGitHostRegistry(refTo(GITHUB_SCHEME_URL))).rejects.toMatchObject({ reason: 'ratelimited' })
  })
})

describe('an open store revalidates rather than trusting what it already has', () => {
  it('asks with the stored etag and serves the cached bytes when the host answers 304', async () => {
    seedCache(RELEASE_ASSET_URL)
    const probe = servedBy({ [RELEASE_ASSET_URL]: answer(304, '') })
    const fetched = await fetchGitHostRegistry(refTo(RELEASE_ASSET_URL))

    expect(probe.headersSent[0]['if-none-match']).toBe(CACHED_ETAG)
    expect(fetched.fromCache).toBe(true)
    expect(fetched.index.name).toBe('Fixture List')
  })

  it('takes the republished list when the host answers 200, never the cached copy', async () => {
    seedCache(RELEASE_ASSET_URL)
    servedBy({ [RELEASE_ASSET_URL]: answer(200, REPUBLISHED_BYTES) })
    const fetched = await fetchGitHostRegistry(refTo(RELEASE_ASSET_URL))

    expect(fetched.fromCache).toBe(false)
    expect(fetched.index.name).toBe('Republished List')
  })
})
