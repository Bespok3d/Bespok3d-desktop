import type { Plugin } from '../../../data/types'
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import { sameVersion, versionLabel } from '../../../utils/version'
import { IconChip, IconUsers, IconDownload } from '../../../design-system/icons'
import { TrustPill } from '../../common/badges/TrustPill'
import { StatusPill } from '../../common/badges/StatusPill'
import { CAT_ICONS, CAT_CLASS } from '../browse/PluginCard'
import { useAssetInfo } from './tabs/sources'

export function PanelHead({ plugin, installed, deactivated, hasUpdate, installedVersion }: { plugin: Plugin; installed: boolean; deactivated?: boolean; hasUpdate: boolean; installedVersion?: string }) {
  const { t } = useI18n()
  const CatIcon = CAT_ICONS[plugin.category] ?? IconChip
  const iconClass = CAT_CLASS[plugin.category] ?? 'mac'
  const trustLabel = t(`trust.${plugin.trust}.full`)
  // Installed version is read live from the printer; fall back to the catalog version when browsing.
  const shownVersion = installed && installedVersion ? installedVersion : plugin.version
  // The packaged upstream version pairs with the shown version only when that version is the one the
  // catalog describes: while browsing, or an installed build that still matches the catalog entry. A
  // drifted install (a plugin version the catalog no longer lists) shows plain, since its packaged
  // upstream is not the catalog's.
  const showsCatalogVersion = !installed || !installedVersion || sameVersion(installedVersion, plugin.version)
  const shownSwVersion = showsCatalogVersion ? plugin.swVersion : undefined
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
