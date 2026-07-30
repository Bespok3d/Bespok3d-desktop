// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What the store page shows as a plugin's version, once its own repo has been asked.
//
// ASKED WHEN A PAGE OPENS, NOT AT START-UP, and that is a measured choice. The published front page
// carries eleven lists and ten distinct publishing repos, so start-up already spends twenty two
// anonymous GitHub requests of the sixty an hour it is allowed. One release read per repo on top of
// that would take it to thirty two on every launch, and a second launch inside the hour would run the
// owner out of requests. Asking only for the plugin whose page is open costs one request, and the ETag
// conditional makes re-opening the same page free.
import { loadCatalog } from '../registry'
import { withFreshestRelease } from '../registry/resolve/refresh-entry'
import { findCatalogVariant } from './catalog-archive'

// null means "the list is already current", which is the answer for a bundled plugin, a repo with no
// release, and a repo that would not answer. The renderer keeps showing the listed version for all of
// them, so an unreachable repo is never visible as a failure.
export async function freshestListedVersion(pluginId: string, sourceUrl?: string): Promise<string | null> {
  const catalog = (await loadCatalog()).plugins
  // Guarded rather than caught: naming a plugin the catalog does not carry throws, and the store page
  // asking about a plugin it just rendered is not that case.
  if (!catalog.some((candidate) => candidate.name === pluginId)) return null
  const listed = findCatalogVariant(catalog, pluginId, sourceUrl)
  const fresh = await withFreshestRelease(listed)

  return fresh.version === listed.version ? null : fresh.version
}
