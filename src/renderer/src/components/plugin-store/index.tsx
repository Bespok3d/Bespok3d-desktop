// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { Plugin, Printer, PluginConfigField } from '../../data/types'
import type { PluginVarsSave, ScopeChoice } from '../../data/plugin-vars'
import type { Collection } from '../../data/collections'
import { useCatalog } from '../../data/catalog'
import { emptyStoreReason, offersSignIn } from '../../data/source-failure'
import type { EmptyStoreReason } from '../../data/source-failure'
import { PanelSpinner } from '../common/feedback/PanelSpinner'
import { Button } from '../common/Button'
import { IconBox, IconGitHub } from '../../design-system/icons'
import { usePrintState } from './usePrintState'
import { useBatchInstall } from './select/useBatchInstall'
import { useBatchUninstall } from './select/useBatchUninstall'
import { SelectModeBars } from './select/ModeBars'
import { SafetyNoticeOverlay } from './safety/RecoveryModal'
import { Toolbar, FilterShoulder, useFacetState } from './browse/Toolbar'
import type { SortKey, SortDir } from './browse/filters'
import { useInstallState, useUpdateAll, useFocusPanel } from './state'
import { useChannelPrefs } from '../common/hooks/useChannelPrefs'
import { deriveStoreView, activeSelection } from './browse/view-model'
import { StoreMain } from './browse/grid'
import type { StoreCardContext, Density } from './browse/grid'
import { CollectionSection } from './browse/CollectionSection'
import { CollectionDetailPanel } from './detail/CollectionDetailPanel'
import { StoreDetailPanel } from './detail/StoreDetailPanel'
import type { TabRequest } from './detail/StoreDetailPanel'
import './plugin-store.css'

interface PluginStoreProps {
  printer?: Printer | null
  density?: Density
  grouped?: boolean
  onPrinterUpdate?: (updater: (prev: Printer[]) => Printer[]) => void
  // The selected printer's resolved flat view of the scoped vars store, plus the scope-aware write
  // path and the per-field effective-scope resolver (both bound to the selected printer by App).
  savedPluginVars?: Record<string, string>
  onSaveVars?: (save: PluginVarsSave) => void
  scopeFor?: (field: PluginConfigField) => ScopeChoice
  onUpdateAll?: (printerId: string, updates: PluginUpdateSpec[]) => void
  updatingAll?: boolean
  onInstallSelected?: (printerId: string, specs: PluginUpdateSpec[]) => void
  installingSelected?: boolean
  onUninstallSelected?: (printerId: string, pluginIds: string[], cascade: boolean) => void
  uninstallingSelected?: boolean
  // When set (e.g. after a drag-drop "install now"), open that plugin's detail panel, then clear it.
  focusPluginId?: string | null
  onFocusHandled?: () => void
  // Open Settings to the Git Host pane, for the empty-store sign-in CTA when a private source is locked.
  onConnectGitHub?: () => void
}

// Shown when the catalog has no plugins to display, saying which of the several very different things
// went wrong: a spent anonymous request ration, a private list, an unreachable GitHub, or nothing to
// show at all. Only the ones a sign-in actually fixes offer the button (the bell notice alone is easy
// to miss, and can be read-from-a-previous-day).
function EmptyStore({ reason, onConnectGitHub }: { reason: EmptyStoreReason; onConnectGitHub: () => void }) {
  const { t } = useI18n()

  return (
    <div className="main store-empty">
      <div className="store-empty-icon">{offersSignIn(reason) ? <IconGitHub size={34} /> : <IconBox size={34} />}</div>
      <div className="store-empty-title">{t(`store.empty.${reason}.title`)}</div>
      <div className="store-empty-body">{t(`store.empty.${reason}.body`)}</div>
      {offersSignIn(reason) && (
        <Button variant="primary" onClick={onConnectGitHub}>
          <IconGitHub size={15} /> {t('repos.sign_in')}
        </Button>
      )}
    </div>
  )
}

function StoreLoading() {
  const { t } = useI18n()

  return (
    <div className="store">
      <div className="main store-loading">
        <PanelSpinner />
        <span>{t('store.loading')}</span>
      </div>
    </div>
  )
}

// gate-allow components_without_story: the store shell; its surfaces (browse cards, the detail/config/collection panels) each have their own catalog stories, and a full-store story needs live catalog+printer+install providers that just re-render the running app.
export function PluginStore({ printer, density, grouped = false, onPrinterUpdate, savedPluginVars, onSaveVars, scopeFor, onUpdateAll, updatingAll = false, onInstallSelected, installingSelected = false, onUninstallSelected, uninstallingSelected = false, focusPluginId, onFocusHandled, onConnectGitHub }: PluginStoreProps) {
  const managedId = printer?.status === 'managed' ? printer.id : undefined
  const [query, setQuery] = useState('')
  const facets = useFacetState()
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [panelPlugin, setPanelPlugin] = useState<Plugin | null>(null)
  const [panelCollection, setPanelCollection] = useState<Collection | null>(null)
  const [tabRequest, setTabRequest] = useState<TabRequest | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const { plugins: catalogPlugins, collections, loading, refresh, sources } = useCatalog()
  const channelPrefs = useChannelPrefs()
  const { disabledChannels, ceilingFor } = channelPrefs
  const { liveInstalledIds, liveInstalledVersions, liveDeactivatedIds, pluginHistory, onOperationDone, safetyNotice, dismissSafetyNotice } = useInstallState(printer, onPrinterUpdate, installingSelected || uninstallingSelected || updatingAll)
  const { printActive, blockedActions } = usePrintState(printer)
  const { installedIds, installedVersions, deactivatedIds, orphans, displayPlugins, matchOpts, showFlat, matchingPlugins, flatPlugins } = deriveStoreView({
    printer, catalogPlugins,
    live: { installedIds: liveInstalledIds, installedVersions: liveInstalledVersions, deactivatedIds: liveDeactivatedIds },
    filters: { query, channels: facets.channels, categories: facets.categories, trusts: facets.trusts, statuses: facets.statuses, printerOnly: facets.printerOnly, grouped, sortKey, sortDir, ceilingFor, disabledChannels },
  })
  const batch = useBatchInstall({ catalogPlugins, installedIds, deactivatedIds, savedVars: savedPluginVars ?? {}, printerId: managedId, printActive, blockedActions, onSaveVars, onInstallSelected })
  const uninstall = useBatchUninstall({ plugins: catalogPlugins, installedIds, printerId: managedId, onUninstallSelected })
  const selection = activeSelection(batch, uninstall)
  const cardCtx: StoreCardContext = { installedIds, installedVersions, installedChannels: printer?.installedChannels ?? {}, deactivatedIds, ceilingFor, disabledChannels, selection }
  const { updatableCount, updateBlock, updateAll } = useUpdateAll({ printerId: managedId, plugins: catalogPlugins, installedIds, installedVersions, savedVars: savedPluginVars ?? {}, ceilingFor, disabledChannels, printActive, blockedActions, onUpdateAll })

  useFocusPanel(focusPluginId, catalogPlugins, setPanelPlugin, onFocusHandled)

  function onSort(key: SortKey) {
    if (key === sortKey) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc');

 return }
    setSortKey(key)
    setSortDir(key === 'name' ? 'asc' : 'desc')
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  if (loading) return <StoreLoading />
  const selecting = batch.active || uninstall.active

  return (
    <div className="store">
      <Toolbar
        query={query} count={matchingPlugins.length} layout={layout} filtersOpen={filtersOpen} filtersActive={facets.active} sortKey={sortKey} sortDir={sortDir}
        updatableCount={updatableCount} updatingAll={updatingAll} updateBlock={updateBlock} onUpdateAll={updateAll} selectAvailable={!!managedId} selectActive={selecting} canUninstall={installedIds.length > 0}
        onSelectInstall={() => { uninstall.exit(); batch.enter() }} onSelectUninstall={() => { batch.exit(); uninstall.enter() }} onExitSelect={() => { batch.exit(); uninstall.exit() }}
        refreshing={refreshing} onRefresh={handleRefresh} onQuery={setQuery} onLayout={setLayout} onToggleFilters={() => setFiltersOpen(!filtersOpen)} onSort={onSort}
      />
      <div className="store-body">
        <FilterShoulder open={filtersOpen} {...facets} />
        {matchingPlugins.length === 0 ? (
          <EmptyStore reason={emptyStoreReason(displayPlugins.length > 0, sources)} onConnectGitHub={() => onConnectGitHub?.()} />
        ) : (
          <StoreMain showFlat={showFlat} flatPlugins={flatPlugins} displayPlugins={displayPlugins} orphans={orphans} matchOpts={matchOpts} ctx={cardCtx} layout={layout} sortKey={sortKey} sortDir={sortDir} showCategory={facets.categories.length === 0} density={density} onOpen={setPanelPlugin}
            collectionShelf={selecting ? null : <CollectionSection collections={collections} plugins={catalogPlugins} installedIds={installedIds} onOpen={setPanelCollection} />} />
        )}
      </div>
      <SelectModeBars install={batch} uninstall={uninstall} installingSelected={installingSelected} uninstallingSelected={uninstallingSelected} savedVars={savedPluginVars ?? {}} />
      {panelPlugin && (
        <StoreDetailPanel
          plugin={panelPlugin} printer={printer} view={{ installedIds, installedVersions, deactivatedIds }} channelPrefs={channelPrefs}
          printActive={printActive} blockedActions={blockedActions} savedPluginVars={savedPluginVars} onSaveVars={onSaveVars} scopeFor={scopeFor}
          onOperationDone={onOperationDone} history={pluginHistory.get(panelPlugin.id)} catalogPlugins={catalogPlugins} tabRequest={tabRequest}
          onSelectPlugin={setPanelPlugin} onTabRequest={setTabRequest}
        />
      )}
      {panelCollection && (
        <CollectionDetailPanel
          collection={panelCollection} plugins={catalogPlugins} installedIds={installedIds} printerId={managedId} installing={installingSelected}
          printActive={printActive} blockedActions={blockedActions}
          savedPluginVars={savedPluginVars} onSaveVars={onSaveVars} onInstallSelected={onInstallSelected}
          onOpenPlugin={setPanelPlugin} onClose={() => setPanelCollection(null)}
        />
      )}
      <SafetyNoticeOverlay notice={safetyNotice} plugins={catalogPlugins} printer={printer} onClose={dismissSafetyNotice} />
    </div>
  )
}
