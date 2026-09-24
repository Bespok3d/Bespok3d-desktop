// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A published entry carries either the asset's API address or the durable tag-and-filename address,
// and the source row shows the same download count and publish date for both. Before this, a durable
// address was fetched as if it were the API asset object, got the package bytes back, and the row
// silently lost both labels. These pin that the durable shape resolves to the same stats and that the
// API shape is untouched.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const userDataDir = mkdtempSync(join(tmpdir(), 'b3-github-asset-'))

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (buffer: Buffer) => buffer.toString('utf8').replace(/^enc:/, ''),
  },
}))

import { assetInfo } from './index'

const API_ASSET = 'https://api.github.com/repos/Bespok3d/u1-motion-tweaks/releases/assets/536914264'
const DURABLE_ASSET = 'https://github.com/Bespok3d/u1-motion-tweaks/releases/download/tmc-autotune-v0.1.1/tmc-autotune-0.1.1.b3'
const RELEASE_OF_TAG = 'https://api.github.com/repos/Bespok3d/u1-motion-tweaks/releases/tags/tmc-autotune-v0.1.1'
const STATS = { download_count: 42, created_at: '2026-06-05T12:30:00Z' }

interface Probe {
  requested: string[]
}

function serveJson(routes: Record<string, unknown>): Probe {
  const probe: Probe = { requested: [] }
  vi.stubGlobal('fetch', (url: string) => {
    probe.requested.push(url)
    const body = routes[url]

    return Promise.resolve(new Response(JSON.stringify(body ?? {}), { status: body === undefined ? 404 : 200 }))
  })

  return probe
}

describe('a source row reports the same stats for either published address', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the stats straight off the API asset address', async () => {
    const probe = serveJson({ [API_ASSET]: STATS })
    expect(await assetInfo(API_ASSET)).toEqual({ downloadCount: 42, publishedAt: '2026-06-05' })
    expect(probe.requested).toEqual([API_ASSET])
  })

  it('resolves the durable tag-and-filename address to its API asset before reading the same stats', async () => {
    const probe = serveJson({
      [RELEASE_OF_TAG]: { assets: [{ name: 'tmc-autotune-0.1.1.b3', url: API_ASSET }, { name: 'index.json', url: 'https://api.github.com/repos/Bespok3d/u1-motion-tweaks/releases/assets/9' }] },
      [API_ASSET]: STATS,
    })
    expect(await assetInfo(DURABLE_ASSET)).toEqual({ downloadCount: 42, publishedAt: '2026-06-05' })
    expect(probe.requested).toEqual([RELEASE_OF_TAG, API_ASSET])
  })

  it('ignores a sibling asset of the same release and names the one that was published', async () => {
    serveJson({
      [RELEASE_OF_TAG]: { assets: [{ name: 'index.json', url: 'https://api.github.com/repos/Bespok3d/u1-motion-tweaks/releases/assets/9' }] },
      'https://api.github.com/repos/Bespok3d/u1-motion-tweaks/releases/assets/9': STATS,
    })
    expect(await assetInfo(DURABLE_ASSET)).toEqual({ downloadCount: null, publishedAt: null })
  })

  it('leaves an address that is not the durable shape alone rather than guessing a repo', async () => {
    const probe = serveJson({ [API_ASSET]: STATS })
    const unreadable = 'https://github.com/Bespok3d/u1-motion-tweaks/blob/main/tmc-autotune/doc/README.md'
    await assetInfo(unreadable)
    expect(probe.requested).toEqual([unreadable])
  })

  it('answers unknown stats instead of throwing when the release will not say', async () => {
    serveJson({})
    expect(await assetInfo(DURABLE_ASSET)).toEqual({ downloadCount: null, publishedAt: null })
  })
})
