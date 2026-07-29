// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../../../data/types'
import { useI18n } from '../../../../i18n/context'
import cx from '../../../../utils/cx'
import { isSideloaded } from '../derive'

export type DetailTab = 'overview' | 'versions' | 'doc' | 'config' | 'changelog' | 'log' | 'captured'

const TAB_LABEL: Record<DetailTab, string> = {
  overview: 'store.tab_overview',
  versions: 'store.tab_versions',
  doc: 'store.tab_docs',
  config: 'store.tab_config',
  changelog: 'store.tab_changelog',
  log: 'store.tab_log',
  captured: 'store.tab_captured',
}

export function PanelTabs({ tabs, active, onTab }: { tabs: DetailTab[]; active: DetailTab; onTab: (next: DetailTab) => void }) {
  const { t } = useI18n()

  return (
    <div className="panel-tabs">
      {tabs.map((tabId) => (
        <button key={tabId} className={cx('panel-tab', tabId === active && 'active')} onClick={() => onTab(tabId)}>
          {t(TAB_LABEL[tabId])}
        </button>
      ))}
    </div>
  )
}

export function detailTabs(plugin: Plugin, hasLog: boolean, hasCaptured: boolean, installed: boolean, installedVersion?: string, installedSource?: string): DetailTab[] {
  // Sideloaded packages always get a Doc tab: it renders their local README, or "no documentation".
  const hasDoc = !!plugin.doc || !!plugin.homepage || isSideloaded(plugin)
  const hasConfig = !!plugin.config
  const hasChangelog = !!plugin.changelog
  // Show Versions when there is something to reconcile: the catalog offers this plugin more than once,
  // OR the install on the printer is not cleanly the single listed source at the same version. That
  // covers a version mismatch AND an install whose source is not in the catalog (installed from an
  // older bundle or a source no longer listed) so the user can always see and act on what they have.
  // A clean install matching the single listed source at the same version has nothing to reconcile.
  const installedLinked = !!installedSource && plugin.sources.some((source) => source.registryUrl === installedSource)
  const needsReconcile = installed && !!installedVersion && (installedVersion !== plugin.version || !installedLinked)
  const hasVersions = plugin.sources.length > 1 || needsReconcile

  return (['overview', 'versions', 'doc', 'config', 'changelog', 'log', 'captured'] as DetailTab[]).filter((tabId) =>
    tabId === 'overview' || (tabId === 'versions' && hasVersions) || (tabId === 'doc' && hasDoc)
    || (tabId === 'config' && hasConfig) || (tabId === 'changelog' && hasChangelog) || (tabId === 'log' && hasLog)
    || (tabId === 'captured' && hasCaptured))
}

// With more than one source, the first Install click opens the Versions picker so the user chooses
// which version/source before it installs; a second click (from that tab) proceeds with the choice.
export function nudgeInstall(plugin: Plugin, activeTab: DetailTab, setTab: (next: DetailTab) => void, install: () => void): void {
  if (plugin.sources.length > 1 && activeTab !== 'versions') { setTab('versions');

 return }
  install()
}
