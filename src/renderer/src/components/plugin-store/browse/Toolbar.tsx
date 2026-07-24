import { useState } from 'react'
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import type { TrustTier, ReleaseChannel } from '../../../data/types'
import { IconSearch, IconGrid, IconListView, IconFilter, IconArrowUp, IconRefresh, IconCheckCircle } from '../../../design-system/icons'
import { Button } from '../../common/Button'
import { Flyout } from '../../common/overlay/Flyout'
import type { SortKey, SortDir, StatusFacet } from './filters'
import type { FacetState } from './FilterShoulder'

export { FilterShoulder } from './FilterShoulder'
export type { FacetState } from './FilterShoulder'

const SORT_KEYS: SortKey[] = ['name', 'published', 'updated']

function ViewControls({ layout, onLayout }: {
  layout: 'grid' | 'list'; onLayout: (v: 'grid' | 'list') => void
}) {
  const { t } = useI18n()

  return (
    <div className="view-controls">
      <Button icon variant="ghost" size="sm" className={cx(layout === 'grid' && 'active')} onClick={() => onLayout('grid')} title={t('store.view_grid')}>
        <IconGrid size={15} />
      </Button>
      <Button icon variant="ghost" size="sm" className={cx(layout === 'list' && 'active')} onClick={() => onLayout('list')} title={t('store.view_list')}>
        <IconListView size={15} />
      </Button>
    </div>
  )
}

function SortGroup({ sortKey, sortDir, onSort }: { sortKey: SortKey; sortDir: SortDir; onSort: (key: SortKey) => void }) {
  const { t } = useI18n()

  return (
    <div className="filter-group sort-group">
      {SORT_KEYS.map((key) => (
        <button key={key} className={cx('filter-chip', key === sortKey && 'active')} onClick={() => onSort(key)}>
          {t(`sort.${key}`)}
          {key === sortKey && (
            <span className={cx('sort-arrow', sortDir === 'desc' && 'desc')}><IconArrowUp size={11} /></span>
          )}
        </button>
      ))}
    </div>
  )
}

// The select control: a menu (pick install- or uninstall-select) while idle, an active toggle that
// exits while a mode runs. Uninstall-select only appears when the printer has installed plugins.
function SelectControl({ active, canUninstall, onSelectInstall, onSelectUninstall, onExit }: {
  active: boolean; canUninstall: boolean
  onSelectInstall: () => void; onSelectUninstall: () => void; onExit: () => void
}) {
  const { t } = useI18n()
  if (active) return (
    <Button icon variant="ghost" size="sm" className="active" onClick={onExit} title={t('store.select')} aria-label={t('store.select')}>
      <IconCheckCircle size={15} />
    </Button>
  )

  return (
    <Flyout anchor={
      <Button icon variant="ghost" size="sm" title={t('store.select')} aria-label={t('store.select')}>
        <IconCheckCircle size={15} />
      </Button>
    }>
      <button className="flyout-item" onClick={onSelectInstall}>{t('store.select_install')}</button>
      {canUninstall && <button className="flyout-item" onClick={onSelectUninstall}>{t('store.select_uninstall')}</button>}
    </Flyout>
  )
}

export function Toolbar({ query, count, layout, filtersOpen, filtersActive, sortKey, sortDir, updatableCount, updatingAll, onUpdateAll, selectAvailable, selectActive, canUninstall, onSelectInstall, onSelectUninstall, onExitSelect, refreshing, onRefresh, onQuery, onLayout, onToggleFilters, onSort }: {
  query: string; count: number
  layout: 'grid' | 'list'; filtersOpen: boolean; filtersActive: boolean; sortKey: SortKey; sortDir: SortDir
  updatableCount: number; updatingAll: boolean; onUpdateAll: () => void
  selectAvailable: boolean; selectActive: boolean; canUninstall: boolean
  onSelectInstall: () => void; onSelectUninstall: () => void; onExitSelect: () => void
  refreshing: boolean; onRefresh: () => void
  onQuery: (q: string) => void; onLayout: (l: 'grid' | 'list') => void; onToggleFilters: () => void
  onSort: (key: SortKey) => void
}) {
  const { t } = useI18n()

  return (
    <div className="toolbar">
      <Button icon variant="ghost" size="sm" className={cx((filtersOpen || filtersActive) && 'active')} onClick={onToggleFilters} title={t('filter.filters')}>
        <IconFilter size={15} />
        {filtersActive && <span className="filter-active-dot" />}
      </Button>
      <div className="search">
        <span className="search-icon"><IconSearch size={16} /></span>
        <input type="text" placeholder={t('filter.search')} value={query} onChange={(changeEvent) => onQuery(changeEvent.target.value)} />
      </div>
      <span className="plugin-count">{t('store.plugin_count', { count })}</span>
      {selectAvailable && (
        <SelectControl active={selectActive} canUninstall={canUninstall} onSelectInstall={onSelectInstall} onSelectUninstall={onSelectUninstall} onExit={onExitSelect} />
      )}
      {updatableCount > 0 && (
        <Button variant="primary" size="sm" disabled={updatingAll} onClick={onUpdateAll}>
          {updatingAll ? t('store.updating_all') : t('store.update_all', { count: updatableCount })}
        </Button>
      )}
      <SortGroup sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      <Button icon variant="ghost" size="sm" busy={refreshing} onClick={onRefresh} title={t('store.refresh')} aria-label={t('store.refresh')}>
        <IconRefresh size={15} />
      </Button>
      <ViewControls layout={layout} onLayout={onLayout} />
    </div>
  )
}

// The store-front facet selections (the shoulder's state). `active` drives the funnel's dot. Kept as a
// hook so the store body stays under the size cap and the shoulder gets the whole bundle by spread.
export function useFacetState(): FacetState & { active: boolean } {
  const [channels, setChannels] = useState<ReleaseChannel[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [trusts, setTrusts] = useState<TrustTier[]>([])
  const [statuses, setStatuses] = useState<StatusFacet[]>([])
  const [printerOnly, setPrinterOnly] = useState(false)
  const active = channels.length > 0 || categories.length > 0 || trusts.length > 0 || statuses.length > 0 || printerOnly

  return { channels, categories, trusts, statuses, printerOnly, setChannels, setCategories, setTrusts, setStatuses, setPrinterOnly, active }
}
