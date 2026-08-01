// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The catalog entry point: declare which sources the app browses (the bundled offline copy, the
// official remote list, and the user's sideloaded files), then resolve them into the catalog the
// renderer shows plus the truthful source list for the Repositories pane. The resolution subsystem
// (graph walk + fetch transports + merge) lives in resolve/; this file owns "which sources, then load".
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { resolveCatalog } from './resolve'
import { DEFAULT_LIMITS } from './model'
import type { RegistryRef, CatalogResult, MergedEntry } from './model'
import { withCachedRelease } from './resolve/refresh-entry'
import { normalizeRegistryUrl } from './resolve/url'
import { buildSources } from './resolve/sources'
import type { ConfiguredSource, SourceRow } from './resolve/sources'
import { fetchGitHostRegistry } from './resolve/fetch'
import { devSourcePath } from './dev-sources'
import { loadSettings } from '../settings'
import { stampListingRefreshed } from './listing-freshness'
import { userLocalSourceUrl, userLocalIndexExists } from './local'

export type { CatalogResult } from './model'

function bundledRegistryDir(): string {
  const devOverride = devSourcePath('dist/plugins')
  if (devOverride) return devOverride

  return is.dev ? join(__dirname, '../../dist/plugins') : join(process.resourcesPath, 'plugins')
}

function bundledRegistryRef(): RegistryRef {
  return { url: join(bundledRegistryDir(), 'index.json'), trust: 'project', locked: true }
}

// The official published list is a hardcoded built-in root, not a user setting, so a stale
// git-host.json can never drop it. The bundled offline copy is listed first so locally built
// plugins shadow the published ones (same name + version).
const OFFICIAL_REMOTE: ConfiguredSource = {
  url: 'github:Bespok3d/main-index/index.json',
  label: 'github:Bespok3d/main-index',
  name: 'Bespok3d Official',
  trust: 'project',
  locked: true,
}

function bundledSource(): ConfiguredSource {
  return { url: bundledRegistryRef().url, label: 'bundled (offline copy)', name: 'Bespok3d Official', trust: 'project', locked: true }
}

// The user's own sideloaded packages (dropped .b3 files): a disk source under userData, trust 'any'
// because the files are unverified. Only listed once the user has dropped at least one package, so
// an unused install shows no source row. Distinct label + trust set it apart from the bundled copy.
function userLocalSource(): ConfiguredSource {
  return { url: userLocalSourceUrl(), label: 'Sideloaded local files', name: 'Sideloaded', trust: 'any', locked: false }
}

// The bundled index is a permanent first-class source, listed first in every build. Today it carries
// the plugins that still live in this repo, so a tester keeps the full catalogue offline; the source
// stays forever even as those migrate out. The user-local source is appended when present.
export function configuredSources(): ConfiguredSource[] {
  const builtIn = [bundledSource(), OFFICIAL_REMOTE]

  return userLocalIndexExists() ? [...builtIn, userLocalSource()] : builtIn
}

function toRef(source: ConfiguredSource): RegistryRef {
  return { url: source.url, trust: source.trust, locked: source.locked }
}

export interface Catalog extends CatalogResult {
  sources: SourceRow[]
}

// THE ONE PLACE A REFRESHED RELEASE IS APPLIED. Everything the renderer reads about a plugin comes
// through here, so the listing, the update badge, the notification zone, a single install and the
// batch update all see the same entry, and none of them can offer a version whose asset did not move
// with it. Applied to the variants too, because the badge picks among them under the user's channel
// ceiling and would otherwise read a stale one. No request is made: this is what the last refresh
// pass already learned.
function withRefreshedReleases(entry: MergedEntry): MergedEntry {
  const refreshed = withCachedRelease(entry)
  if (!entry.variants) return refreshed

  return { ...refreshed, variants: entry.variants.map(withCachedRelease) }
}

// The catalog the renderer browses, plus the truthful source list for the Repositories pane. A
// disabled source is left out of the fetch but still reported (as off), and the resolver isolates a
// per-source fetch failure so one unreachable list never wipes the store.
//
// Every reader of the lists lands here (start-up, the refresh wheel, turning a source on), so this is
// where "what we know is this old" is recorded. A pass that lost a source is not recorded as fresh:
// starting the app with no network must not silence the offer to check.
export async function loadCatalog(): Promise<Catalog> {
  const sources = configuredSources()
  const disabled = new Set((loadSettings().disabledSources ?? []).map(normalizeRegistryUrl))
  const enabled = sources.filter((source) => !disabled.has(normalizeRegistryUrl(source.url))).map(toRef)
  const result = await resolveCatalog(enabled, fetchGitHostRegistry, DEFAULT_LIMITS, (message) => console.warn(`[registry] ${message}`))
  if (result.failures.length === 0) stampListingRefreshed()

  return { ...result, plugins: result.plugins.map(withRefreshedReleases), sources: buildSources(sources, result, disabled) }
}
