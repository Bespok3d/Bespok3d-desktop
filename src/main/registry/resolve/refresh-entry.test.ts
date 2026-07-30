// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The pairing is the whole risk in this feature: the version and the download url move together or not
// at all. A raised version over a stale url makes every install of that plugin refuse, because the
// package fetched is older than the entry now claims. The badge is the second thing pinned here: a
// refreshed entry keeps the trust it was signed into, and never gains any.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MergedEntry } from '../model'

const mocks = vi.hoisted(() => ({ fetchLatestRelease: vi.fn() }))

vi.mock('./latest-release', () => ({ fetchLatestRelease: mocks.fetchLatestRelease }))

import { withFreshestRelease } from './refresh-entry'

const LISTED_ASSET_URL = 'https://api.github.com/repos/fixture-owner/rfid-tools/releases/assets/1111'
const FRESH_ASSET_URL = 'https://api.github.com/repos/fixture-owner/rfid-tools/releases/assets/2222'

function listedEntry(fields: Record<string, unknown> = {}): MergedEntry {
  return {
    name: 'rfid-tools',
    version: '0.1.9',
    download_url: LISTED_ASSET_URL,
    trust: 'project',
    signer: 'Fixture Publisher',
    registry_url: 'https://lists.example.invalid/community.json',
    ...fields,
  }
}

beforeEach(() => {
  mocks.fetchLatestRelease.mockReset()
})

describe('withFreshestRelease', () => {
  it('moves the version and the download url together', async () => {
    mocks.fetchLatestRelease.mockResolvedValue({ version: '0.1.10', downloadUrl: FRESH_ASSET_URL })
    const refreshed = await withFreshestRelease(listedEntry())

    expect(refreshed.version).toBe('0.1.10')
    expect(refreshed.download_url).toBe(FRESH_ASSET_URL)
  })

  it('keeps the badge the signed list entry came with, and gains none', async () => {
    mocks.fetchLatestRelease.mockResolvedValue({ version: '0.1.10', downloadUrl: FRESH_ASSET_URL })
    const refreshed = await withFreshestRelease(listedEntry())

    expect(refreshed.trust).toBe('project')
    expect(refreshed.signer).toBe('Fixture Publisher')
    expect(refreshed.registry_url).toBe('https://lists.example.invalid/community.json')
  })

  it('asks the repo the listed package comes from, for the plugin by name', async () => {
    mocks.fetchLatestRelease.mockResolvedValue(null)
    await withFreshestRelease(listedEntry())

    expect(mocks.fetchLatestRelease).toHaveBeenCalledWith({ owner: 'fixture-owner', repo: 'rfid-tools' }, 'rfid-tools')
  })

  it('leaves the entry untouched when the repo has no release to name', async () => {
    mocks.fetchLatestRelease.mockResolvedValue(null)

    expect(await withFreshestRelease(listedEntry())).toEqual(listedEntry())
  })

  it('never asks anything for a bundled entry that names no repo', async () => {
    const bundled = listedEntry({ download_url: 'packages/rfid-tools-0.1.9.b3' })

    expect(await withFreshestRelease(bundled)).toEqual(bundled)
    expect(mocks.fetchLatestRelease).not.toHaveBeenCalled()
  })

  it('never walks the store backwards when the repo is behind the list', async () => {
    mocks.fetchLatestRelease.mockResolvedValue({ version: '0.1.8', downloadUrl: FRESH_ASSET_URL })
    const refreshed = await withFreshestRelease(listedEntry())

    expect(refreshed.version).toBe('0.1.9')
    expect(refreshed.download_url).toBe(LISTED_ASSET_URL)
  })

  it('leaves the listed url in place when the repo release matches the list', async () => {
    mocks.fetchLatestRelease.mockResolvedValue({ version: '0.1.9', downloadUrl: FRESH_ASSET_URL })

    expect((await withFreshestRelease(listedEntry())).download_url).toBe(LISTED_ASSET_URL)
  })
})
