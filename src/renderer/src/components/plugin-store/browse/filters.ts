// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, ReleaseChannel, TrustTier } from '../../../data/types'
import type { CeilingResolver } from '../../../data/channels'
import { ALLOW_ALL_CHANNELS, availableVersion, publishedChannels } from '../../../data/channels'
import { isNewerVersion } from '../../../utils/version'

export type StatusFacet = 'installed' | 'not-installed' | 'needs-updating'

export interface MatchOpts {
  query: string
  channels: ReleaseChannel[]
  categories: string[]
  trusts: TrustTier[]
  statuses: StatusFacet[]
  printerOnly: boolean
  installedIds: string[]
  installedVersions: Record<string, string>
  // needs-updating compares against the user's real ceiling; absent in tests where it does not matter.
  ceilingFor?: CeilingResolver
  disabledChannels?: ReleaseChannel[]
}

// Empty facet means "no constraint"; otherwise the value must be one of the selected (OR within a facet).
function facetPass<Selectable>(selected: Selectable[], value: Selectable): boolean {
  return selected.length === 0 || selected.includes(value)
}

// The channel facet is the explicit override that surfaces above-ceiling plugins: it matches when any
// channel the plugin publishes is in the selected set, independent of the stability ceiling.
function channelPass(selected: ReleaseChannel[], plugin: Plugin): boolean {
  return selected.length === 0 || publishedChannels(plugin).some((channel) => selected.includes(channel))
}

function needsUpdate(plugin: Plugin, opts: MatchOpts): boolean {
  const installedVer = opts.installedVersions[plugin.id]
  const ceiling = (opts.ceilingFor ?? ALLOW_ALL_CHANNELS)(plugin.id)

  return !!installedVer && isNewerVersion(availableVersion(plugin, ceiling, opts.disabledChannels ?? []), installedVer)
}

function statusMatches(status: StatusFacet, plugin: Plugin, opts: MatchOpts): boolean {
  const installed = opts.installedIds.includes(plugin.id)
  if (status === 'installed') return installed
  if (status === 'not-installed') return !installed

  return installed && needsUpdate(plugin, opts)
}

function statusPass(plugin: Plugin, opts: MatchOpts): boolean {
  return opts.statuses.length === 0 || opts.statuses.some((status) => statusMatches(status, plugin, opts))
}

function queryPass(plugin: Plugin, query: string): boolean {
  return !query || (plugin.title + ' ' + plugin.name + ' ' + plugin.tagline).toLowerCase().includes(query.toLowerCase())
}

export function matchesPlugin(plugin: Plugin, opts: MatchOpts): boolean {
  if (!queryPass(plugin, opts.query)) return false
  if (opts.printerOnly && !plugin.printerSpecific) return false
  if (!facetPass(opts.categories, plugin.category)) return false
  if (!facetPass(opts.trusts, plugin.trust)) return false
  if (!channelPass(opts.channels, plugin)) return false

  return statusPass(plugin, opts)
}

// Add or remove a value from a facet selection (multi-select chip toggle).
export function toggleFacet<Selectable>(values: Selectable[], value: Selectable): Selectable[] {
  return values.includes(value) ? values.filter((existing) => existing !== value) : [...values, value]
}

// Single-select facet: picking a value replaces any prior pick; clicking the active value clears it.
export function selectFacet<Selectable>(values: Selectable[], value: Selectable): Selectable[] {
  return values.includes(value) ? [] : [value]
}

export type SortKey = 'name' | 'published' | 'updated'
export type SortDir = 'asc' | 'desc'

function dateField(plugin: Plugin, key: SortKey): string {
  if (key === 'published') return plugin.publishedAt ?? ''

  return plugin.updatedAt ?? ''
}

function comparePlugins(earlier: Plugin, later: Plugin, key: SortKey): number {
  if (key === 'name') return earlier.title.localeCompare(later.title)
  const earlierDate = dateField(earlier, key)
  const laterDate = dateField(later, key)
  if (earlierDate === laterDate) return earlier.title.localeCompare(later.title)

  return earlierDate < laterDate ? -1 : 1
}

export function sortPlugins(plugins: Plugin[], key: SortKey, dir: SortDir): Plugin[] {
  const factor = dir === 'asc' ? 1 : -1

  return [...plugins].sort((earlier, later) => comparePlugins(earlier, later, key) * factor)
}
