// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The refresh pass that runs when someone says yes to the offer (listing-freshness.ts makes it).
import { loadCatalog } from './index'
import { runRefreshPass } from './refresh-pass'
import type { RefreshPassResult } from './refresh-pass'

// The catalog load stamps the age itself, so a refresh the user asked for and the load at start-up
// count the same: the lists were asked about just now.
export async function refreshListing(): Promise<RefreshPassResult> {
  return runRefreshPass((await loadCatalog()).plugins)
}
