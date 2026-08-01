// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The offer in front of an install is the only thing that ever spends the app's hourly GitHub
// allowance on release reads, so what is asserted here is that it comes up when what we know is an
// hour old, that it does NOT come up a second time inside that hour whichever way it was answered,
// and that reading the lists is what makes them recent.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}))

vi.mock('../settings', () => ({ loadSettings: mocks.loadSettings, saveSettings: mocks.saveSettings }))
vi.mock('./resolve/release-asks', () => ({ FRESHNESS_WINDOW_MS: 60 * 60 * 1000 }))

import { offerListingRefresh, stampListingRefreshed } from './listing-freshness'

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

describe('what makes the lists count as recent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSettings.mockReturnValue({})
  })

  it('records when the lists were read, so the hour starts from that read', () => {
    stampListingRefreshed(NOW)

    expect(mocks.saveSettings).toHaveBeenCalledWith({ listingRefreshedAt: NOW })
  })

  it('silences the offer for the hour after the lists were read', () => {
    stampListingRefreshed(NOW)
    mocks.loadSettings.mockReturnValue({ listingRefreshedAt: NOW })

    expect(offerListingRefresh(NOW + 10 * 60 * 1000).offered).toBe(false)
  })
})
