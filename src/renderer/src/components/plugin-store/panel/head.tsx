// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../../data/types'
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import { sameVersion, versionLabel } from '../../../utils/version'
import { IconChip, IconUsers, IconDownload } from '../../../design-system/icons'
import { TrustPill } from '../../common/badges/TrustPill'
import { StatusPill } from '../../common/badges/StatusPill'
import { CAT_ICONS, CAT_CLASS } from '../browse/PluginCard'
import { useAssetInfo } from './tabs/sources'
import { useFreshestVersion } from './freshest-version'

export function PanelHead({ plugin, installed, deactivated, hasUpdate, installedVersion }: { plugin: Plugin; installed: boolean; deactivated?: boolean; hasUpdate: boolean; installedVersion?: string }) {
  const { t } = useI18n()
  const CatIcon = CAT_ICONS[plugin.category] ?? IconChip
  const iconClass = CAT_CLASS[plugin.category] ?? 'mac'
  const trustLabel = t(`trust.${plugin.trust}.full`)
  // Installed version is read live from the printer. Browsing shows what the plugin's own repo last
  // released, which is the listed version until that repo answers with something newer.
  const freshestVersion = useFreshestVersion(plugin.name)
  const shownVersion = installed && installedVersion ? installedVersion : freshestVersion ?? plugin.version
  // The packaged upstream version pairs with the shown version only when that version is the one the
  // catalog describes. A drifted install (a plugin version the catalog no longer lists) and a version
  // fresher than the list both show plain, since neither one's packaged upstream is the catalog's.
  const shownSwVersion = sameVersion(shownVersion, plugin.version) ? plugin.swVersion : undefined
  const remoteSource = plugin.sources.find((source) => source.downloadUrl && /^https?:/.test(source.downloadUrl))
  const stat = useAssetInfo(remoteSource?.downloadUrl)

  return (
    <div className="panel-head">
      <div className="panel-hero">
        <div className={cx('card-icon', iconClass)}>
          <CatIcon size={30} />
        </div>
        <div className="panel-titles">
          <h1>{plugin.title}</h1>
          <div className="sub">
            <code>{plugin.name}</code>
            <span>·</span>
            <span>{versionLabel(t, shownVersion, shownSwVersion)}</span>
          </div>
        </div>
      </div>
      <div className="panel-stat-row">
        <TrustPill trust={plugin.trust} icon full title={trustLabel} />
        {deactivated && <StatusPill status="disabled" />}
        {hasUpdate && !deactivated && <StatusPill status="update" />}
        {installed && !deactivated && !hasUpdate && <StatusPill status="installed" />}
        {plugin.signer && <span className="chip"><IconUsers size={12} /> {plugin.signer}</span>}
        {stat.publishedAt && <span className="chip">{t('store.published', { date: stat.publishedAt })}</span>}
        {stat.downloadCount != null && <span className="chip"><IconDownload size={12} /> {t('store.downloads', { count: stat.downloadCount })}</span>}
      </div>
    </div>
  )
}
