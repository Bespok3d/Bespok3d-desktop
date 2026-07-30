// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The offer in front of an install is the only thing that ever spends the app's hourly GitHub
// allowance on release reads, so what is asserted here is that it comes up when the list is an hour
// old, that it does NOT come up a second time inside that hour whichever way it was answered, and that
// a pass records when it ran.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  loadCatalog: vi.fn(),
  runRefreshPass: vi.fn(),
}))

vi.mock('../settings', () => ({ loadSettings: mocks.loadSettings, saveSettings: mocks.saveSettings }))
vi.mock('./index', () => ({ loadCatalog: mocks.loadCatalog }))
vi.mock('./refresh-pass', () => ({ runRefreshPass: mocks.runRefreshPass }))
vi.mock('./resolve/release-asks', () => ({ FRESHNESS_WINDOW_MS: 60 * 60 * 1000 }))

import { offerListingRefresh, refreshListing } from './listing-refresh'

const ONE_HOUR_MS = 60 * 60 * 1000
const NOW = 1_800_000_000_000

describe('the refresh offered before an install', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSettings.mockReturnValue({})
  })

  it('is offered when the plugin list has never been refreshed', () => {
    expect(offerListingRefresh(NOW)).toEqual({ offered: true, refreshedAt: null })
  })

  it('states the age the list actually has, so the question is not a guess', () => {
    mocks.loadSettings.mockReturnValue({ listingRefreshedAt: NOW - 3 * ONE_HOUR_MS })

    expect(offerListingRefresh(NOW).refreshedAt).toBe(NOW - 3 * ONE_HOUR_MS)
  })

  it('is not offered when the list was refreshed inside the hour', () => {
    mocks.loadSettings.mockReturnValue({ listingRefreshedAt: NOW - 59 * 60 * 1000 })

    expect(offerListingRefresh(NOW).offered).toBe(false)
  })

  it('records the offer as it is made, so the install is not asked again this hour', () => {
    offerListingRefresh(NOW)

    expect(mocks.saveSettings).toHaveBeenCalledWith({ listingRefreshProposedAt: NOW })
  })

  it('is not offered again inside the hour after someone chose the list as it stands', () => {
    mocks.loadSettings.mockReturnValue({ listingRefreshProposedAt: NOW - 10 * 60 * 1000 })

    expect(offerListingRefresh(NOW).offered).toBe(false)
    expect(mocks.saveSettings).not.toHaveBeenCalled()
  })

  it('is offered again once the hour is up', () => {
    mocks.loadSettings.mockReturnValue({ listingRefreshedAt: NOW - ONE_HOUR_MS, listingRefreshProposedAt: NOW - ONE_HOUR_MS })

    expect(offerListingRefresh(NOW).offered).toBe(true)
  })
})

describe('the pass a yes starts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSettings.mockReturnValue({})
    mocks.loadCatalog.mockResolvedValue({ plugins: [{ name: 'camera', version: '0.1.0' }] })
    mocks.runRefreshPass.mockResolvedValue({ askedRepos: 1, moved: [{ pluginName: 'camera', listedVersion: '0.1.0', freshVersion: '0.2.0' }] })
  })

  it('asks about the plugins the catalog lists and hands back what moved', async () => {
    const pass = await refreshListing()

    expect(mocks.runRefreshPass).toHaveBeenCalledWith([{ name: 'camera', version: '0.1.0' }])
    expect(pass.moved).toEqual([{ pluginName: 'camera', listedVersion: '0.1.0', freshVersion: '0.2.0' }])
  })

  it('records that the list was refreshed even when nothing moved', async () => {
    mocks.runRefreshPass.mockResolvedValue({ askedRepos: 1, moved: [] })
    await refreshListing()

    expect(mocks.saveSettings).toHaveBeenCalledWith({ listingRefreshedAt: expect.any(Number) })
  })
})
