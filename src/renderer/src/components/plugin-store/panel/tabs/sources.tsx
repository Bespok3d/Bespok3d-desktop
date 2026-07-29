// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, PluginSource, ReleaseChannel } from '../../../../data/types'
import type { TFunction } from '../../../../i18n'
import cx from '../../../../utils/cx'
import { isNewerVersion, sameVersion, versionLabel } from '../../../../utils/version'
import { useAsyncResource } from '../../../common/hooks/useAsyncResource'
import { IconTrash } from '../../../../design-system/icons'
import { Button } from '../../../common/Button'
import { TrustPill } from '../../../common/badges/TrustPill'
import { ChannelPill } from '../../../common/badges/ChannelPill'

export { ChannelSelector } from './channel-selector'

// A variant's identity is registryUrl x channel, not registryUrl alone: one source can publish the
// same plugin id at several channels. The selection state keys on this composite.
export function sourceKey(source: PluginSource): string {
  return `${source.registryUrl}::${source.channel}`
}

// The newest variant a given channel publishes for this plugin (drives the channel-chip selection).
export function newestSourceOfChannel(plugin: Plugin, channel: ReleaseChannel): PluginSource | undefined {
  return plugin.sources
    .filter((source) => source.channel === channel)
    .reduce<PluginSource | undefined>((best, source) => (!best || isNewerVersion(source.version, best.version) ? source : best), undefined)
}

// A sideloaded package (trust 'any' + disk source) is the user's own dropped/created copy, the only
// kind they can remove from the local registry.
function isSideloadedSource(source: PluginSource): boolean {
  return source.local && source.trust === 'any'
}

// A row is the printer's install only when BOTH its registry and channel match what was recorded.
// registryUrl alone is wrong when one registry serves the same id on two channels (a stable atom and
// an experiment atom): the experiment row would otherwise borrow the stable install's version and
// pair a channel label with a version from a different atom. Older records carry no channel, so a
// missing installedChannel falls back to registry-only matching.
export function isInstalledVariant(source: PluginSource, installedSource?: string, installedChannel?: ReleaseChannel): boolean {
  if (source.registryUrl !== installedSource) return false

  return installedChannel === undefined || source.channel === installedChannel
}

// The version to show on a row: the numeric release without build metadata, so a dev-bundle atom reads
// `0.1.7`, not `0.1.7+dev.bb3a283c`. The channel (any prerelease tail) is conveyed by the ChannelPill.
function displayVersion(version: string): string {
  return version.split('+')[0]
}

interface AssetStat {
  downloadCount: number | null
  publishedAt: string | null
}

const EMPTY_STAT: AssetStat = { downloadCount: null, publishedAt: null }

// Real, fetched-from-GitHub stats for a source's release asset (download count + actual upload
// date). The manifest's published_at / publisher are placeholders, so the detail shows these.
export function useAssetInfo(downloadUrl?: string): AssetStat {
  function loadStat() {
    if (!downloadUrl || !/^https?:/.test(downloadUrl)) return Promise.resolve(EMPTY_STAT)

    return window.b3d.registry.assetInfo(downloadUrl)
  }

  return useAsyncResource(loadStat, [downloadUrl]).value ?? EMPTY_STAT
}

function SourceItemRow({ source, selected, isInstalled, shownVersion, shownSwVersion, onSelect, t }: {
  source: PluginSource; selected: boolean; isInstalled: boolean; shownVersion: string; shownSwVersion?: string; onSelect: () => void; t: TFunction
}) {
  const stat = useAssetInfo(source.downloadUrl)

  return (
    <button className={cx('source-row', selected && 'selected')} onClick={onSelect} type="button">
      <span className={cx('source-radio', selected && 'on')} />
      <span className="source-label mono">{source.label}</span>
      <ChannelPill channel={source.channel} />
      <span className="card-version">{versionLabel(t, shownVersion, shownSwVersion)}</span>
      {stat.publishedAt && <span className="source-date">{stat.publishedAt}</span>}
      {stat.downloadCount != null && <span className="source-date">{t('store.downloads', { count: stat.downloadCount })}</span>}
      <TrustPill trust={source.trust} />
      {source.local && <span className="local-badge">{t('store.local_source')}</span>}
      {isInstalled && <span className="source-installed">{t('store.source_installed')}</span>}
    </button>
  )
}

// Each source row shows the version that source OFFERS (never the installed version): a source that has
// drifted ahead of the printer must advertise its available build, or the listing would say "0.1.6"
// while the Update action targets 0.1.7. What is actually on the printer is surfaced by a separate,
// read-only "on this printer" entry.
export function SourcesSection({ sources, selected, installedSource, installedChannel, installedVersion, onSelect, onRemoveLocal, t }: {
  sources: PluginSource[]; selected?: string; installedSource?: string; installedChannel?: ReleaseChannel; installedVersion?: string
  onSelect: (key: string) => void; onRemoveLocal?: () => void; t: TFunction
}) {
  // A source is the current install only when it is the one the printer was installed from AND it still
  // offers that exact version. When it has moved on (its version drifted past what is installed), no row
  // is the current install and the read-only on-printer entry carries the "Installed" state instead.
  function isCurrentInstall(source: PluginSource): boolean {
    return isInstalledVariant(source, installedSource, installedChannel)
      && !!installedVersion && sameVersion(source.version, installedVersion)
  }

  function rowFor(source: PluginSource) {
    const removable = !!onRemoveLocal && isSideloadedSource(source)

    return (
      <div key={sourceKey(source)} className="source-row-wrap">
        <SourceItemRow
          source={source} selected={sourceKey(source) === selected} isInstalled={isCurrentInstall(source)}
          shownVersion={displayVersion(source.version)} shownSwVersion={source.swVersion}
          onSelect={() => onSelect(sourceKey(source))} t={t}
        />
        {removable && (
          <Button variant="ghost" icon className="source-remove" type="button" title={t('btn.remove')} onClick={onRemoveLocal}>
            <IconTrash size={14} />
          </Button>
        )}
      </div>
    )
  }
  // What is on the printer when no listed source offers that exact build: installed from a source no
  // longer in the catalog, or from a source that has since moved to another version. Shown read-only so
  // the user always SEES what they have; the only actions are uninstall, or switching to a source below.
  const currentInstallListed = sources.some(isCurrentInstall)

  return (
    <div className="panel-sources">
      <div className="panel-sources-title">{t('store.sources')}</div>
      <div className="panel-sources-hint">{t('store.sources_hint')}</div>
      {installedVersion && !currentInstallListed && (
        <div className="source-row on-printer">
          <span className="source-label">{t('store.source_on_printer')}</span>
          <span className="card-version">v{displayVersion(installedVersion)}</span>
          <span className="source-installed">{t('store.source_installed')}</span>
        </div>
      )}
      {sources.map(rowFor)}
    </div>
  )
}
