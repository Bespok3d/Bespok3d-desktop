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

// The store's view model: resolve the installed/deactivated sets (live, falling back to the printer
// record), then the orphan + filtered + sorted plugin lists. Pure, so it stays out of the component
// body and is testable on its own.
export function deriveStoreView({ printer, catalogPlugins, live, filters }: StoreViewInputs) {
  const installedIds = live.installedIds ?? (printer?.status === 'managed' ? (printer?.installedIds ?? []) : [])
  const installedVersions = live.installedVersions ?? printer?.installedVersions ?? {}
  const deactivatedIds = live.deactivatedIds ?? printer?.deactivatedIds ?? []
  const orphans = orphanPlugins(catalogPlugins, installedIds, installedVersions)
  const displayPlugins = [...catalogPlugins, ...orphans]
  const matchOpts: MatchOpts = {
    query: filters.query, channels: filters.channels, categories: filters.categories, trusts: filters.trusts,
    statuses: filters.statuses, printerOnly: filters.printerOnly, installedIds, installedVersions,
    ceilingFor: filters.ceilingFor, disabledChannels: filters.disabledChannels,
  }
  const matching = displayPlugins.filter((plugin) => matchesPlugin(plugin, matchOpts))
  const showFlat = filters.categories.length > 0 || !filters.grouped
  const flatPlugins = showFlat ? sortPlugins(matching, filters.sortKey, filters.sortDir) : []

  return { installedIds, installedVersions, deactivatedIds, orphans, displayPlugins, matchOpts, showFlat, matchingPlugins: matching, flatPlugins }
}

// The active select pick across both mutually-exclusive modes: install-select (pick not-installed) or
// uninstall-select (pick installed). Returns undefined in normal browse mode.
export function activeSelection(install: ReturnType<typeof useBatchInstall>, uninstall: ReturnType<typeof useBatchUninstall>): CardSelection | undefined {
  if (install.active) return { selectedIds: install.selectedIds, selectableIds: install.installableIds, onToggle: install.toggle }
  if (uninstall.active) return { selectedIds: uninstall.selectedIds, selectableIds: uninstall.uninstallableIds, onToggle: uninstall.toggle }

  return undefined
}
