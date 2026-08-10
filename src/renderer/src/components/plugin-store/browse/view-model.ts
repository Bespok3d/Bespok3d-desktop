// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, Printer, TrustTier, ReleaseChannel } from '../../../data/types'
import type { CeilingResolver } from '../../../data/channels'
import { matchesPlugin, sortPlugins } from './filters'
import type { MatchOpts, SortKey, SortDir, StatusFacet } from './filters'
import { orphanPlugins } from '../../../data/deps/orphans'
import type { useBatchInstall } from '../select/useBatchInstall'
import type { useBatchUninstall } from '../select/useBatchUninstall'
import type { CardSelection } from './grid'

interface StoreFilters {
  query: string; channels: ReleaseChannel[]; categories: string[]; trusts: TrustTier[]; statuses: StatusFacet[]
  printerOnly: boolean; grouped: boolean; sortKey: SortKey; sortDir: SortDir
  ceilingFor: CeilingResolver; disabledChannels: ReleaseChannel[]
}

interface StoreViewInputs {
  printer: Printer | null | undefined
  catalogPlugins: Plugin[]
  live: { installedIds: string[] | null; installedVersions: Record<string, string> | null; deactivatedIds: string[] | null }
  filters: StoreFilters
}

// The daemon and this printer's jinni are on the printer, but they are not in the plugin tree the
// daemon lists, so nothing else here would know what they are running. A plugin's daemon floor and a
// dependency on the daemon are both checked against this. Only a managed printer has machinery to
// report; the map left on a record from a past enrollment says nothing about a printer we cannot reach
// now.
function machineryOnPrinter(printer: Printer | null | undefined): Record<string, string> {
  if (printer?.status !== 'managed') return {}

  return printer.machineryVersions ?? {}
}

// The store does not list the daemon or the jinni. The store's buttons all run the plugin install
// path, and neither package places any files that way: enrollment puts them on the printer over SSH,
// and the printer's own update is what moves them. A card here could only offer an Update that reports
// success and changes nothing. They stay in the installed sets above, because plugins are still gated
// against the daemon version the printer runs.
function browsablePlugins(catalogPlugins: Plugin[]): Plugin[] {
  return catalogPlugins.filter((plugin) => !plugin.systemPackage)
}

// The store's view model: resolve the installed/deactivated sets (live, falling back to the printer
// record), then the orphan + filtered + sorted plugin lists. Pure, so it stays out of the component
// body and is testable on its own.
export function deriveStoreView({ printer, catalogPlugins, live, filters }: StoreViewInputs) {
  const machineryVersions = machineryOnPrinter(printer)
  const pluginIds = live.installedIds ?? (printer?.status === 'managed' ? (printer?.installedIds ?? []) : [])
  const installedIds = [...new Set([...pluginIds, ...Object.keys(machineryVersions)])]
  const installedVersions = { ...(live.installedVersions ?? printer?.installedVersions ?? {}), ...machineryVersions }
  const installedSources = printer?.installedSources ?? {}
  const deactivatedIds = live.deactivatedIds ?? printer?.deactivatedIds ?? []
  // The orphan pass is given the PLUGIN ids only. Fed the machinery, it would synthesize a remove-only
  // card for any machinery package this build has no catalog entry for, which is the app offering to
  // uninstall the daemon from an enrolled printer.
  const orphans = orphanPlugins(catalogPlugins, pluginIds, installedVersions)
  const displayPlugins = [...browsablePlugins(catalogPlugins), ...orphans]
  const matchOpts: MatchOpts = {
    query: filters.query, channels: filters.channels, categories: filters.categories, trusts: filters.trusts,
    statuses: filters.statuses, printerOnly: filters.printerOnly, installedIds, installedVersions, installedSources,
    ceilingFor: filters.ceilingFor, disabledChannels: filters.disabledChannels,
  }
  const matching = displayPlugins.filter((plugin) => matchesPlugin(plugin, matchOpts))
  const showFlat = filters.categories.length > 0 || !filters.grouped
  const flatPlugins = showFlat ? sortPlugins(matching, filters.sortKey, filters.sortDir) : []

  return { installedIds, installedVersions, installedSources, deactivatedIds, orphans, displayPlugins, matchOpts, showFlat, matchingPlugins: matching, flatPlugins }
}

// The active select pick across both mutually-exclusive modes: install-select (pick not-installed) or
// uninstall-select (pick installed). Returns undefined in normal browse mode.
export function activeSelection(install: ReturnType<typeof useBatchInstall>, uninstall: ReturnType<typeof useBatchUninstall>): CardSelection | undefined {
  if (install.active) return { selectedIds: install.selectedIds, selectableIds: install.installableIds, onToggle: install.toggle }
  if (uninstall.active) return { selectedIds: uninstall.selectedIds, selectableIds: uninstall.uninstallableIds, onToggle: uninstall.toggle }

  return undefined
}
