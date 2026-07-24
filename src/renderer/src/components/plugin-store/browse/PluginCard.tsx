import type { ComponentType } from 'react'
import type { Plugin, ReleaseChannel } from '../../../data/types'
import type { IconProps } from '../../../design-system/icons'
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import { versionLabel } from '../../../utils/version'
import { IconCamera, IconSpool, IconScreen, IconChip, IconGlobe, IconSliders, IconBolt, IconSettings, IconLayers } from '../../../design-system/icons'
import { TrustPill } from '../../common/badges/TrustPill'
import { StatusPill } from '../../common/badges/StatusPill'
import { ChannelPill } from '../../common/badges/ChannelPill'

export const CAT_ICONS: Record<string, ComponentType<IconProps>> = {
  camera: IconCamera, filament: IconSpool, screen: IconScreen, ui: IconGlobe,
  tuning: IconSliders, sensors: IconBolt, system: IconSettings, printing: IconLayers,
}
export const CAT_CLASS: Record<string, string> = {
  camera: 'cam', filament: 'fil', screen: 'scr', ui: 'ui',
  tuning: 'tun', sensors: 'sen', system: 'sys', printing: 'prn',
}


interface PluginCardProps {
  plugin: Plugin
  installed: boolean
  deactivated?: boolean
  hasUpdate: boolean
  // The version/channel that would install at the user's ceiling (the effective variant); falls back
  // to the plugin's own when nothing is within the ceiling (e.g. an orphan).
  displayVersion: string
  // The packaged upstream version of the effective variant, when this plugin wraps an external
  // project; shown as the primary version with the plugin version in brackets.
  displaySwVersion?: string
  displayChannel: ReleaseChannel
  // The channel the printer's installed copy came from; badged only when installed.
  installedChannel?: ReleaseChannel
  layout: 'grid' | 'list'
  showCategory?: boolean
  onOpen: () => void
  // Select mode (multi-install): when selecting, a click toggles the pick instead of opening the
  // panel. selectable is false for cards that cannot be batch-installed (already on the printer).
  selecting?: boolean
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

// The card's click target depends on the mode: open the detail panel normally, toggle the pick while
// selecting, and do nothing for a card that cannot be picked.
function cardPrimaryAction(selecting: boolean, selectable: boolean, onToggleSelect: (() => void) | undefined, onOpen: () => void): (() => void) | undefined {
  if (!selecting) return onOpen

  return selectable ? onToggleSelect : undefined
}

// One channel marker per card: when installed, the channel the printer is on (provenance); otherwise
// the would-install channel, but only when it is not plain stable (stable needs no pill).
function cardChannelBadge(installed: boolean, installedChannel: ReleaseChannel | undefined, displayChannel: ReleaseChannel): { channel: ReleaseChannel; installed: boolean } | null {
  if (installed) return installedChannel ? { channel: installedChannel, installed: true } : null

  return displayChannel === 'stable' ? null : { channel: displayChannel, installed: false }
}

// The foot button reflects the plugin's state on the printer: update if a newer version is available,
// manage if it is installed and current, install otherwise (the install path is not yet wired, so it
// carries a "coming soon" hint instead of a click handler).
function CardFootAction({ hasUpdate, installed, onClick }: { hasUpdate: boolean; installed: boolean; onClick: (event: { stopPropagation: () => void }) => void }) {
  const { t } = useI18n()
  if (hasUpdate) return <span className="btn primary sm" role="button" tabIndex={0} onClick={onClick}>{t('btn.update')}</span>
  if (installed) return <span className="btn ghost sm" role="button" tabIndex={0} onClick={onClick}>{t('btn.manage')}</span>

  return <span className="btn primary sm" role="button" tabIndex={0} title={t('store.coming_soon')}>{t('btn.install')}</span>
}

export function PluginCard({ plugin, installed, deactivated, hasUpdate, displayVersion, displaySwVersion, displayChannel, installedChannel, layout, showCategory, onOpen, selecting = false, selectable = false, selected = false, onToggleSelect }: PluginCardProps) {
  const { t } = useI18n()
  const CatIcon = CAT_ICONS[plugin.category] ?? IconChip
  var iconClass = CAT_CLASS[plugin.category] ?? 'mac'
  const badge = cardChannelBadge(installed, installedChannel, displayChannel)
  const primaryAction = cardPrimaryAction(selecting, selectable, onToggleSelect, onOpen)
  function footClick(event: { stopPropagation: () => void }) {
    event.stopPropagation()
    primaryAction?.()
  }

  return (
    <button data-flip-key={plugin.id} className={cx('card', installed && 'installed', hasUpdate && 'has-update', layout === 'list' && 'list', selecting && 'selecting', selected && 'selected', selecting && !selectable && 'inert')} onClick={primaryAction} type="button">
      <div className="card-top">
        {selecting && selectable && <span className={cx('card-select', selected && 'on')} aria-hidden>{selected ? '✓' : ''}</span>}
        <div className={cx('card-icon', iconClass)}>
          <CatIcon size={24} />
        </div>
        <div className="card-heading">
          <div className="card-title">{plugin.title}</div>
          <div className="card-publisher">
            <TrustPill trust={plugin.trust} icon title={plugin.trust} />
            <span className="card-version">{versionLabel(t, displayVersion, displaySwVersion)}</span>
            {badge && (
              <ChannelPill channel={badge.channel} installed={badge.installed} title={badge.installed ? t('store.installed_channel') : undefined} />
            )}
            {plugin.sources.length > 1 && (
              <span className="multi-source" title={t('store.multi_source_hint')}>
                {t('store.sources_count', { count: plugin.sources.length })}
              </span>
            )}
            {showCategory && (
              <span className="cat-chip">
                <span className={cx('cat-dot', iconClass)} />{t(`cat.${plugin.category}`)}
              </span>
            )}
          </div>
        </div>
        {deactivated && <StatusPill status="disabled" />}
        {hasUpdate && !deactivated && <StatusPill status="update" />}
        {installed && !deactivated && !hasUpdate && <StatusPill status="installed" />}
      </div>

      <p className="card-desc">{plugin.tagline}</p>

      {plugin.deps.length > 0 && (
        <div className="card-deps">{t('store.requires')} {plugin.deps.join(', ')}</div>
      )}

      <div className="card-foot">
        <span className="card-version-foot">{versionLabel(t, displayVersion, displaySwVersion)}</span>
        <CardFootAction hasUpdate={hasUpdate} installed={installed} onClick={footClick} />
      </div>
    </button>
  )
}
