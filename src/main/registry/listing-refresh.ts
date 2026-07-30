// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The refresh a person is offered before an install, and the pass that runs when they say yes.
//
// NOTHING REFRESHES ON ITS OWN. The app has 60 anonymous GitHub requests an hour for the whole
// address, so the plugin list is only ever re-asked because someone said yes to this offer.
//
// The offer is made at most once an hour, and MAKING it is what records it: a second install in the
// same hour goes straight through, whichever way the first offer was answered. Both stamps live in
// settings because the hour belongs to the address and not to the process: quitting and reopening the
// app does not buy another offer.
import { loadSettings, saveSettings } from '../settings'
import { loadCatalog } from './index'
import { runRefreshPass } from './refresh-pass'
import { FRESHNESS_WINDOW_MS } from './resolve/release-asks'
import type { RefreshPassResult } from './refresh-pass'

export interface RefreshOffer {
  offered: boolean
  // When the plugin list was last refreshed, epoch ms, or null when it never has been. This is the age
  // the offer states, so it is answered here and not guessed at in the renderer.
  refreshedAt: number | null
}

function olderThanTheWindow(at: number | undefined, now: number): boolean {
  return at === undefined || now - at >= FRESHNESS_WINDOW_MS
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

// Stamped whether or not anything moved: what the offer measures is how long it has been since the
// list was asked about, never how long since it last changed.
export async function refreshListing(): Promise<RefreshPassResult> {
  const pass = await runRefreshPass((await loadCatalog()).plugins)
  saveSettings({ listingRefreshedAt: Date.now() })

  return pass
}
