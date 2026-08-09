// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Opening a plugin page used to demand a GitHub account for two reads that are public: the release
// notes and an asset's download count. With no account both threw 'Not connected to GitHub', the throw
// escaped the IPC handler, and the main log filled with a stack trace on every click while the page
// silently fell back to the copy compiled into the app. These tests pin that both reads happen with no
// account, that neither can reject whatever the host does, and that each dead end keeps its own name.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readReleaseDoc, readAssetStat, readReleaseAsset } from './asset-read'

const mocks = vi.hoisted(() => ({ connectedToAGitHost: vi.fn(), downloadReleaseAsset: vi.fn(), assetInfo: vi.fn() }))

// Mocking the avenue module with a factory also keeps ../app-paths (and with it electron) out of the run.
vi.mock('./resolve/anonymous-avenues', () => ({ connectedToAGitHost: mocks.connectedToAGitHost }))
vi.mock('../git-host', () => ({
  activeConnector: () => ({ downloadReleaseAsset: mocks.downloadReleaseAsset, assetInfo: mocks.assetInfo }),
}))

const DOC_URL = 'https://api.github.com/repos/bespok3d-fixture/plugin-repo/releases/assets/42'
const RELEASED_NOTES = '## 0.1.10\nwhat this release changed'
const RATION_SPENT = { 'x-ratelimit-remaining': '0' }

interface HttpProbe {
  headersSent: Record<string, string>[]
}

function serveAsset(answer: Response | Error): HttpProbe {
  const probe: HttpProbe = { headersSent: [] }
  vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
    probe.headersSent.push(init.headers as Record<string, string>)

    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer.clone())
  })

  return probe
}

function anonymousVisitor(): void {
  mocks.connectedToAGitHost.mockResolvedValue(false)
  mocks.downloadReleaseAsset.mockReset()
}

describe('a visitor reads the notes published with a release', () => {
  beforeEach(anonymousVisitor)
  afterEach(() => vi.unstubAllGlobals())

  it('reads the notes published with a release without an account', async () => {
    const probe = serveAsset(new Response(RELEASED_NOTES, { status: 200 }))
    const read = await readReleaseDoc(DOC_URL)
    expect(read).toEqual({ text: RELEASED_NOTES, problem: null })
    expect(Object.keys(probe.headersSent[0])).not.toContain('Authorization')
  })

  it('never asks the connector for a doc a visitor can read', async () => {
    serveAsset(new Response(RELEASED_NOTES, { status: 200 }))
    await readReleaseDoc(DOC_URL)
    expect(mocks.downloadReleaseAsset).not.toHaveBeenCalled()
  })

  it('calls a release that answered with nothing empty, not unreachable', async () => {
    serveAsset(new Response('   \n', { status: 200 }))
    expect(await readReleaseDoc(DOC_URL)).toEqual({ text: null, problem: 'empty' })
  })
})

describe('a doc that did not arrive keeps the name of what stopped it', () => {
  beforeEach(anonymousVisitor)
  afterEach(() => vi.unstubAllGlobals())

  it('says the host could not be reached when the request never arrived', async () => {
    serveAsset(new Error('getaddrinfo ENOTFOUND api.github.com'))
    expect(await readReleaseDoc(DOC_URL)).toEqual({ text: null, problem: 'unreachable' })
  })

  it('names the spent request ration rather than blaming the connection', async () => {
    serveAsset(new Response('', { status: 403, headers: RATION_SPENT }))
    expect(await readReleaseDoc(DOC_URL)).toEqual({ text: null, problem: 'ratelimited' })
  })

  it('falls back to the account for a doc no visitor can see', async () => {
    serveAsset(new Response('', { status: 404 }))
    mocks.connectedToAGitHost.mockResolvedValue(true)
    mocks.downloadReleaseAsset.mockResolvedValue(Buffer.from(RELEASED_NOTES, 'utf8'))
    expect(await readReleaseDoc(DOC_URL)).toEqual({ text: RELEASED_NOTES, problem: null })
  })

  it('answers with the problem instead of rejecting when the account read fails too', async () => {
    serveAsset(new Response('', { status: 401 }))
    mocks.connectedToAGitHost.mockResolvedValue(true)
    mocks.downloadReleaseAsset.mockRejectedValue(new Error('Not connected to GitHub'))
    expect(await readReleaseDoc(DOC_URL)).toEqual({ text: null, problem: 'private' })
  })
})

// Installing a plugin demanded a GitHub account too: the download threw 'Not connected to GitHub' and
// the store was a shop window nobody could buy from. A published plugin is a public file, so it comes
// down with no account, and when it truly cannot the person is told something they can act on.
describe('a visitor installs a plugin', () => {
  beforeEach(anonymousVisitor)
  afterEach(() => vi.unstubAllGlobals())

  it('downloads the package with no account and keeps the bytes as they are', async () => {
    const probe = serveAsset(new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), { status: 200 }))
    const bytes = await readReleaseAsset(DOC_URL)
    expect([...bytes]).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(Object.keys(probe.headersSent[0])).not.toContain('Authorization')
    expect(mocks.downloadReleaseAsset).not.toHaveBeenCalled()
  })

  it('says the release is gone rather than naming a missing account', async () => {
    serveAsset(new Response('', { status: 404 }))
    await expect(readReleaseAsset(DOC_URL)).rejects.toThrow(/no longer published at that address/)
  })

  it('says the plugin is not published publicly when the host guards it', async () => {
    serveAsset(new Response('', { status: 401 }))
    await expect(readReleaseAsset(DOC_URL)).rejects.toThrow(/not published publicly/)
  })

  it('blames the connection when the host never answered', async () => {
    serveAsset(new Error('getaddrinfo ENOTFOUND api.github.com'))
    await expect(readReleaseAsset(DOC_URL)).rejects.toThrow(/could not be reached/)
  })

  it('falls back to the account for a plugin whose repo is private', async () => {
    serveAsset(new Response('', { status: 404 }))
    mocks.connectedToAGitHost.mockResolvedValue(true)
    mocks.downloadReleaseAsset.mockResolvedValue(Buffer.from('PRIVATE PACKAGE'))
    expect((await readReleaseAsset(DOC_URL)).toString()).toBe('PRIVATE PACKAGE')
  })
})

// A user could not install Tailscale at all: the download was given the eight seconds written for
// fetching a plugin list, and the package is 34MB. The abort landed mid-download, where nothing mapped
// it, so what reached them was 'TimeoutError: The operation was aborted due to timeout' with no log and
// no reason. Retry could not help either, since every attempt got the same deadline. These pin both
// halves: a package gets an allowance a slow connection can finish in, and a download that does run out
// of time still says something the person can act on.
const BIGGEST_PUBLISHED_PACKAGE_BYTES = 34_181_931
const SLOW_LINK_BYTES_PER_SEC = 250_000
const SLOW_LINK_NEEDS_MS = (BIGGEST_PUBLISHED_PACKAGE_BYTES / SLOW_LINK_BYTES_PER_SEC) * 1000

// The signal a request was given does not carry its own duration, so the ask is what gets recorded.
function recordDeadlinesAsked(): number[] {
  const asked: number[] = []
  const realTimeout = AbortSignal.timeout.bind(AbortSignal)
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
    asked.push(ms)

    return realTimeout(ms)
  })

  return asked
}

// Headers that arrived followed by a body that ran out of time: what an abort part-way through a big
// download actually looks like, which a plain rejected fetch does not reproduce.
function serveHeadersThenTimeout(): void {
  const abortedMidBody = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, status: 200, headers: new Headers(), arrayBuffer: () => Promise.reject(abortedMidBody) }),
  )
}

describe('a plugin package downloads on a slow connection', () => {
  beforeEach(anonymousVisitor)
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('gives the biggest published package long enough to arrive on a slow link', async () => {
    const deadlinesAsked = recordDeadlinesAsked()
    serveAsset(new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), { status: 200 }))
    await readReleaseAsset(DOC_URL)
    expect(Math.min(...deadlinesAsked)).toBeGreaterThanOrEqual(SLOW_LINK_NEEDS_MS)
  })

  it('keeps the short deadline for reading the notes published with a release', async () => {
    const deadlinesAsked = recordDeadlinesAsked()
    serveAsset(new Response(RELEASED_NOTES, { status: 200 }))
    await readReleaseDoc(DOC_URL)
    expect(Math.min(...deadlinesAsked)).toBeLessThan(SLOW_LINK_NEEDS_MS)
  })

  it('blames the connection when the download runs out of time part-way through', async () => {
    serveHeadersThenTimeout()
    await expect(readReleaseAsset(DOC_URL)).rejects.toThrow(/could not be reached/)
  })

  it('never leaks the raw timeout wording to someone installing a plugin', async () => {
    serveHeadersThenTimeout()
    await expect(readReleaseAsset(DOC_URL)).rejects.not.toThrow(/aborted due to timeout/)
  })
})

describe('readAssetStat', () => {
  it('costs a source row its two grey labels rather than rejecting', async () => {
    mocks.assetInfo.mockRejectedValue(new Error('Not connected to GitHub'))
    expect(await readAssetStat(DOC_URL)).toEqual({ downloadCount: null, publishedAt: null })
  })
})
