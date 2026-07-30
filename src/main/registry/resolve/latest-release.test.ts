// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Every way a repo can decline to answer has to leave the store on the listed version rather than break
// it, and the one answer that IS used has to carry a version and a url that came from the same asset.
// A version taken from anywhere else raises the number the store shows without moving the bytes an
// install fetches, and every install of that plugin then refuses as older than the entry claims.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PublishingRepo } from './publishing-repo'

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
  cachedBytes: null as string | null,
  writeCache: vi.fn(),
  releaseAskAllowed: vi.fn(),
  recordReleaseAsk: vi.fn(),
}))

vi.mock('./request', () => ({ httpGet: mocks.httpGet }))
vi.mock('./release-asks', () => ({
  releaseAskAllowed: mocks.releaseAskAllowed,
  recordReleaseAsk: mocks.recordReleaseAsk,
}))
vi.mock('./cache', () => ({
  loadCache: () => new Map(mocks.cachedBytes === null ? [] : [['github-release:fixture-owner/rfid-tools', { bytes: mocks.cachedBytes }]]),
  conditionalHeaders: () => ({ 'If-None-Match': 'W/"fixture-release-etag"' }),
  writeCache: mocks.writeCache,
}))

import { cachedRelease, fetchLatestRelease } from './latest-release'

const REPO: PublishingRepo = { owner: 'fixture-owner', repo: 'rfid-tools' }
const RELEASE_CACHE_KEY = 'github-release:fixture-owner/rfid-tools'
const LATEST_URL = 'https://api.github.com/repos/fixture-owner/rfid-tools/releases/latest'
const FRESH_ASSET_URL = 'https://api.github.com/repos/fixture-owner/rfid-tools/releases/assets/2222'

function answered(status: number, body = ''): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(body),
    headers: new Headers({ etag: 'W/"fixture-release-etag"' }),
  } as unknown as Response
}

function releaseWith(assets: Array<Record<string, unknown>>): string {
  return JSON.stringify({ tag_name: 'v0.2.0', assets })
}

beforeEach(() => {
  mocks.httpGet.mockReset()
  mocks.writeCache.mockReset()
  mocks.recordReleaseAsk.mockReset()
  mocks.releaseAskAllowed.mockReset()
  mocks.releaseAskAllowed.mockReturnValue(true)
  mocks.cachedBytes = null
})

describe('fetchLatestRelease, the answer it uses', () => {
  it('reads the version and the url off the same asset', async () => {
    mocks.httpGet.mockResolvedValue(answered(200, releaseWith([{ name: 'rfid-tools-0.2.0.b3', url: FRESH_ASSET_URL }])))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toEqual({ version: '0.2.0', downloadUrl: FRESH_ASSET_URL })
  })

  it('asks the repo for its latest release with no credentials', async () => {
    mocks.httpGet.mockResolvedValue(answered(404))
    await fetchLatestRelease(REPO, 'rfid-tools')

    expect(mocks.httpGet.mock.calls[0][0]).toBe(LATEST_URL)
    expect(JSON.stringify(mocks.httpGet.mock.calls[0][1])).not.toContain('Authorization')
  })

  it('ignores the release tag, so a tag ahead of the built asset cannot raise the shown version', async () => {
    mocks.httpGet.mockResolvedValue(answered(200, releaseWith([{ name: 'rfid-tools-0.1.9.b3', url: FRESH_ASSET_URL }])))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toEqual({ version: '0.1.9', downloadUrl: FRESH_ASSET_URL })
  })

  it('picks this plugin out of a co-repo release that ships several', async () => {
    const shared = releaseWith([
      { name: 'panel-buttons-0.4.1.b3', url: 'https://api.github.com/repos/fixture-owner/rfid-tools/releases/assets/1' },
      { name: 'rfid-tools-0.2.0.b3', url: FRESH_ASSET_URL },
    ])
    mocks.httpGet.mockResolvedValue(answered(200, shared))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toEqual({ version: '0.2.0', downloadUrl: FRESH_ASSET_URL })
  })
})

describe('fetchLatestRelease when the repo will not answer', () => {
  it('says nothing for a repo with no release', async () => {
    mocks.httpGet.mockResolvedValue(answered(404))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toBeNull()
  })

  it('says nothing for a private or rate-limited answer', async () => {
    mocks.httpGet.mockResolvedValueOnce(answered(403)).mockResolvedValueOnce(answered(401))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toBeNull()
    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toBeNull()
  })

  it('says nothing when the repo cannot be reached at all', async () => {
    mocks.httpGet.mockRejectedValue(new Error('network'))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toBeNull()
  })
})

describe('fetchLatestRelease when the release names nothing installable', () => {
  it('says nothing for a malformed asset name', async () => {
    const malformed = releaseWith([
      { name: 'rfid-tools.b3', url: FRESH_ASSET_URL },
      { name: 'rfid-tools-v0.2.0.b3', url: FRESH_ASSET_URL },
      { name: 'rfid-tools-0.2.0.zip', url: FRESH_ASSET_URL },
      { name: 'rfid-tools-0.2.0.b3.sha256', url: FRESH_ASSET_URL },
    ])
    mocks.httpGet.mockResolvedValue(answered(200, malformed))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toBeNull()
  })

  it('says nothing for an asset with a name but no url', async () => {
    mocks.httpGet.mockResolvedValue(answered(200, releaseWith([{ name: 'rfid-tools-0.2.0.b3' }])))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toBeNull()
  })

  it('says nothing for a body that is not a release', async () => {
    mocks.httpGet.mockResolvedValue(answered(200, '<html>rate limited</html>'))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toBeNull()
  })

})

describe('fetchLatestRelease and its own cache entry', () => {
  it('reuses the cached release when the repo answers not-modified', async () => {
    mocks.cachedBytes = releaseWith([{ name: 'rfid-tools-0.2.0.b3', url: FRESH_ASSET_URL }])
    mocks.httpGet.mockResolvedValue(answered(304))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toEqual({ version: '0.2.0', downloadUrl: FRESH_ASSET_URL })
  })

  it('files a usable release under its own cache key, apart from the served lists', async () => {
    mocks.httpGet.mockResolvedValue(answered(200, releaseWith([{ name: 'rfid-tools-0.2.0.b3', url: FRESH_ASSET_URL }])))
    await fetchLatestRelease(REPO, 'rfid-tools')

    expect(mocks.writeCache.mock.calls[0][0]).toBe(RELEASE_CACHE_KEY)
  })

  it('files nothing when the answer was not a release at all', async () => {
    mocks.httpGet.mockResolvedValue(answered(200, '<html>rate limited</html>'))
    await fetchLatestRelease(REPO, 'rfid-tools')

    expect(mocks.writeCache).not.toHaveBeenCalled()
  })

  // A co-repo ships one asset per plugin in one release. Filing those bytes even when the plugin that
  // paid for the ask is not in them is what lets its siblings read that release for free.
  it('files a co-repo release even when this plugin has no asset in it', async () => {
    const siblingOnly = releaseWith([{ name: 'panel-buttons-0.4.1.b3', url: FRESH_ASSET_URL }])
    mocks.httpGet.mockResolvedValue(answered(200, siblingOnly))

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toBeNull()
    expect(mocks.writeCache.mock.calls[0][0]).toBe(RELEASE_CACHE_KEY)
  })
})

describe('fetchLatestRelease against the hour it is allowed', () => {
  it('counts the ask before the answer, so a not-modified answer is still spent', async () => {
    mocks.cachedBytes = releaseWith([{ name: 'rfid-tools-0.2.0.b3', url: FRESH_ASSET_URL }])
    mocks.httpGet.mockResolvedValue(answered(304))
    await fetchLatestRelease(REPO, 'rfid-tools')

    expect(mocks.recordReleaseAsk).toHaveBeenCalledWith(REPO)
  })

  it('does not ask at all once the hour is spent, and answers from what it last learned', async () => {
    mocks.cachedBytes = releaseWith([{ name: 'rfid-tools-0.2.0.b3', url: FRESH_ASSET_URL }])
    mocks.releaseAskAllowed.mockReturnValue(false)

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toEqual({ version: '0.2.0', downloadUrl: FRESH_ASSET_URL })
    expect(mocks.httpGet).not.toHaveBeenCalled()
    expect(mocks.recordReleaseAsk).not.toHaveBeenCalled()
  })

  it('says nothing when the hour is spent and it never learned this repo', async () => {
    mocks.releaseAskAllowed.mockReturnValue(false)

    expect(await fetchLatestRelease(REPO, 'rfid-tools')).toBeNull()
  })
})

describe('cachedRelease, what the listing reads without asking anybody', () => {
  it('reads this plugin out of the release the pass already filed', () => {
    mocks.cachedBytes = releaseWith([{ name: 'rfid-tools-0.2.0.b3', url: FRESH_ASSET_URL }])

    expect(cachedRelease(REPO, 'rfid-tools')).toEqual({ version: '0.2.0', downloadUrl: FRESH_ASSET_URL })
    expect(mocks.httpGet).not.toHaveBeenCalled()
  })

  it('says nothing for a repo nothing has been filed for', () => {
    expect(cachedRelease(REPO, 'rfid-tools')).toBeNull()
  })
})
