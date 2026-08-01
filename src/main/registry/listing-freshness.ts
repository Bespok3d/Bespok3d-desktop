// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// How old what we know about the plugin lists is, and whether that is old enough to be worth asking
// about before an install.
//
// NOTHING REFRESHES ON ITS OWN. The app has 60 anonymous GitHub requests an hour for the whole
// address, so the lists are only ever re-asked because someone opened the app, clicked the refresh
// wheel, or said yes to this offer.
//
// A leaf on purpose: the catalog load stamps the age here and the offer reads it, so neither has to
// import the other.
import { loadSettings, saveSettings } from '../settings'
import { FRESHNESS_WINDOW_MS } from './resolve/release-asks'

export interface RefreshOffer {
  offered: boolean
  // When the plugin list was last refreshed, epoch ms, or null when it never has been. This is the age
  // the offer states, so it is answered here and not guessed at in the renderer.
  refreshedAt: number | null
}

function olderThanTheWindow(at: number | undefined, now: number): boolean {
  return at === undefined || now - at >= FRESHNESS_WINDOW_MS
}

// Stamped whether or not anything moved: what the offer measures is how long it has been since the
// lists were asked about, never how long since they last changed. Every way the lists are read from
// their sources ends here, so opening the app and clicking the refresh wheel both reset the hour.
export function stampListingRefreshed(now = Date.now()): void {
  saveSettings({ listingRefreshedAt: now })
}

// One definition of recent, and it is `FRESHNESS_WINDOW_MS`: the same hour that stops a repo being
// asked twice decides whether an install is offered a refresh first.
export function offerListingRefresh(now = Date.now()): RefreshOffer {
  const settings = loadSettings()
  const stale = olderThanTheWindow(settings.listingRefreshedAt, now)
  const offer = stale && olderThanTheWindow(settings.listingRefreshProposedAt, now)
  if (offer) saveSettings({ listingRefreshProposedAt: now })

  return { offered: offer, refreshedAt: settings.listingRefreshedAt ?? null }
}
