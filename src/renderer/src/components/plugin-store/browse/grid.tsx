// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ComponentType, ReactNode } from 'react'
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import { isNewerVersion } from '../../../utils/version'
import type { Plugin, ReleaseChannel } from '../../../data/types'
import { effectiveVariant, type CeilingResolver } from '../../../data/channels'
import { BUNDLED_CATEGORIES } from '../../../data/catalog/bundled'
import { IconChip } from '../../../design-system/icons'
import type { IconProps } from '../../../design-system/icons'
import { PluginCard, CAT_ICONS, CAT_CLASS } from './PluginCard'
import { useGridFlip } from './useGridFlip'
import { matchesPlugin, sortPlugins } from './filters'
import type { MatchOpts, SortKey, SortDir } from './filters'

export type Density = 'compact' | 'comfortable' | 'spacious'

// Everything a card needs that is not the plugin itself: the installed sets, the per-plugin channel
// ceiling, and the disabled channels. Threaded as one object so the grid wrappers do not each carry a
// growing prop list. cardProps derives the display version/channel + update flag from it.
export interface StoreCardContext {
  installedIds: string[]
  installedVersions: Record<string, string>
  installedChannels: Record<string, ReleaseChannel>
  deactivatedIds: string[]
  ceilingFor: CeilingResolver
  disabledChannels: ReleaseChannel[]
  selection?: CardSelection
}

// The active multi-select pick (install OR uninstall mode): which cards can be picked, which are
// picked, and how to toggle one. Absent (undefined) when the store is in normal browse mode.
export interface CardSelection {
  selectedIds: string[]
  selectableIds: string[]
  onToggle: (pluginId: string) => void
}

function cardSelectProps(plugin: Plugin, selection: CardSelection | undefined) {
  if (!selection) return { selecting: false }

  return {
    selecting: true,
    selectable: selection.selectableIds.includes(plugin.id),
    selected: selection.selectedIds.includes(plugin.id),
    onToggleSelect: () => selection.onToggle(plugin.id),
  }
}

function cardProps(plugin: Plugin, ctx: StoreCardContext) {
  const installedVersion = ctx.installedVersions[plugin.id]
  const variant = effectiveVariant(plugin, ctx.ceilingFor(plugin.id), ctx.disabledChannels)
  const displayVersion = variant?.version ?? plugin.version
  const displaySwVersion = variant?.swVersion ?? plugin.swVersion

  return {
    installed: ctx.installedIds.includes(plugin.id),
    deactivated: ctx.deactivatedIds.includes(plugin.id),
    hasUpdate: !!installedVersion && isNewerVersion(displayVersion, installedVersion),
    displayVersion,
    displaySwVersion,
    displayChannel: variant?.channel ?? plugin.channel,
    installedChannel: ctx.installedChannels[plugin.id],
    ...cardSelectProps(plugin, ctx.selection),
  }
}

function PluginGrid({ plugins, ctx, layout, showCategory, density, onOpen }: {
  plugins: Plugin[]; ctx: StoreCardContext
  layout: 'grid' | 'list'; showCategory: boolean
  density?: Density; onOpen: (plugin: Plugin) => void
}) {
  const gridRef = useGridFlip(plugins.map((plugin) => plugin.id).join(','))

  return (
    <div ref={gridRef} className="plugin-grid" data-layout={layout} data-density={density ?? 'comfortable'}>
      {plugins.map((plugin) => (
        <PluginCard key={plugin.id} plugin={plugin} {...cardProps(plugin, ctx)} layout={layout} showCategory={showCategory} onOpen={() => onOpen(plugin)} />
      ))}
    </div>
  )
}

function CategorySection({ catId, plugins, ctx, layout, density, onOpen }: {
  catId: string; plugins: Plugin[]; ctx: StoreCardContext
  layout: 'grid' | 'list'; density?: Density; onOpen: (plugin: Plugin) => void
}) {
  const { t } = useI18n()
  if (plugins.length === 0) return null
  const CatIcon: ComponentType<IconProps> = CAT_ICONS[catId] ?? IconChip
  const iconClass = CAT_CLASS[catId] ?? 'mac'

  return (
    <section className="category">
      <div className="category-head">
        <div className="category-title">
          <span className={cx('cat-icon', iconClass)}><CatIcon size={16} /></span>
          {t(`cat.${catId}`)}
          <span className="cat-count">{plugins.length}</span>
        </div>
        <span className="cat-sub">{t(`cat.${catId}.sub`)}</span>
      </div>
      <PluginGrid plugins={plugins} ctx={ctx} layout={layout} showCategory={false} density={density} onOpen={onOpen} />
    </section>
  )
}

// Orphans (installed, no catalog source) have no real category, so in the grouped view they get their
// own trailing section rather than vanishing. Hidden when none match the current filters.
function OrphanSection({ orphans, ctx, layout, density, onOpen }: {
  orphans: Plugin[]; ctx: StoreCardContext
  layout: 'grid' | 'list'; density?: Density; onOpen: (plugin: Plugin) => void
}) {
  const { t } = useI18n()
  if (orphans.length === 0) return null

  return (
    <section className="category">
      <div className="category-head">
        <div className="category-title">
          <span className={cx('cat-icon', 'mac')}><IconChip size={16} /></span>
          {t('store.orphan.title')}
          <span className="cat-count">{orphans.length}</span>
        </div>
        <span className="cat-sub">{t('store.orphan.section_sub')}</span>
      </div>
      <PluginGrid plugins={orphans} ctx={ctx} layout={layout} showCategory={false} density={density} onOpen={onOpen} />
    </section>
  )
}

// The store body: a flat grid (search/category-filtered) or the grouped category sections plus a
// trailing orphan section. Extracted to keep PluginStore under the function-length limit.
export function StoreMain({ showFlat, flatPlugins, displayPlugins, orphans, matchOpts, ctx, layout, sortKey, sortDir, showCategory, density, collectionShelf, onOpen }: {
  showFlat: boolean; flatPlugins: Plugin[]; displayPlugins: Plugin[]; orphans: Plugin[]; matchOpts: MatchOpts
  ctx: StoreCardContext; layout: 'grid' | 'list'
  sortKey: SortKey; sortDir: SortDir; showCategory: boolean
  density?: Density; collectionShelf?: ReactNode; onOpen: (plugin: Plugin) => void
}) {
  if (showFlat) return (
    <div className="main">
      {collectionShelf}
      <PluginGrid plugins={flatPlugins} ctx={ctx} layout={layout} showCategory={showCategory} density={density} onOpen={onOpen} />
    </div>
  )

  return (
    <div className="main">
      {collectionShelf}
      {BUNDLED_CATEGORIES.map((category) => (
        <CategorySection
          key={category.id} catId={category.id}
          plugins={sortPlugins(displayPlugins.filter((plugin) => plugin.category === category.id && matchesPlugin(plugin, matchOpts)), sortKey, sortDir)}
          ctx={ctx} layout={layout} density={density} onOpen={onOpen}
        />
      ))}
      <OrphanSection orphans={orphans.filter((plugin) => matchesPlugin(plugin, matchOpts))} ctx={ctx} layout={layout} density={density} onOpen={onOpen} />
    </div>
  )
}
