// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import type { Plugin, Printer, ReleaseChannel, PluginConfigField } from '../../../data/types'
import type { PluginVarsSave, ScopeChoice } from '../../../data/plugin-vars'
import type { TFunction } from '../../../i18n'
import { useI18n } from '../../../i18n/context'
import { isDaemonVersionAtLeast } from '../../../utils/version'
import { IconClose } from '../../../design-system/icons'
import { Markdown } from '../../common/content/Markdown'
import { docAssetsFor } from '../../../data/catalog/shape'
import { useCatalog } from '../../../data/catalog'
import { usePluginOps, type UsePluginOpsResult } from '../../../hooks/pluginOps'
import { InstallZone, HistoryZone, InstallLogView, InstallRunModal } from './install-log'
import type { PluginHistoryEntry } from '../state'
import { resolveMissingDeps, installedDependents, installedConflicts } from '../../../data/deps'
import { httpPortError, isUiPlugin } from '../../../data/ports'
import { SourcesSection, ChannelSelector, sourceKey, newestSourceOfChannel } from './tabs/sources'
import { usePanelActions } from './actions'
import { PanelConfigArea } from '../config/config-form'
import { usePanelConfigState } from './tabs/config-tab'
import { Button } from '../../common/Button'
import { Modal } from '../../common/overlay/Modal'
import { CapturesView } from './tabs/CapturesView'
import { PanelHead } from './head'
import { PanelBody } from './tabs/overview'
import { PanelTabs, detailTabs, nudgeInstall, type DetailTab } from './tabs'
import { PanelDoc } from './tabs/doc'
import { PanelFoot } from './foot'
import { useReleasedDoc } from './released-doc'
import { PanelGates, useLocalRemove } from './gates'
import { isOrphan, isSideloaded, isSwitchingVariant, defaultSelectedVariant, installGate, hasReleaseNotes } from './derive'

interface PluginPanelProps {
  plugin: Plugin
  printer?: Printer | null
  installed: boolean
  deactivated?: boolean
  hasUpdate: boolean
  printerId?: string
  printActive?: boolean
  blockedActions?: string[]
  daemonVersion?: string
  installedSource?: string
  installedVersion?: string
  installedChannel?: ReleaseChannel
  // The user's channel choices for this plugin: the global default, the effective ceiling (default or
  // per-plugin override), the global opt-outs, and a setter for the per-plugin override.
  primaryChannel?: ReleaseChannel
  channelCeiling?: ReleaseChannel
  disabledChannels?: ReleaseChannel[]
  onChannelPref?: (channel: ReleaseChannel) => void
  allInstalledIds?: string[]
  // The printer-resolved flat view of the saved vars (reads), the scope-aware save path (writes),
  // and the per-field effective-scope resolver (presets the scope control); all bound to the
  // selected printer by App.
  savedPluginVars?: Record<string, string>
  onSaveVars?: (save: PluginVarsSave) => void
  scopeFor?: (field: PluginConfigField) => ScopeChoice
  // Truth-ladder tier 2 for this plugin, from the printer record: the vars this computer last sent
  // and the ISO timestamp of that send. Shown with a stale marker when the live read is unavailable.
  appliedVars?: Record<string, string>
  appliedVarsAt?: string
  onClose: () => void
  onOperationDone?: (ids: string[], pluginId: string, action: 'install' | 'uninstall', log?: InstallLog) => void
  history?: PluginHistoryEntry[]
  // The last install log persisted on the printer record, used so the Install-log tab survives an app
  // restart (the in-memory history is empty on a fresh load).
  installedLog?: InstallLog
  // Detail tab to open on (e.g. from a b3d:// doc link); falls back to overview when not a real tab.
  initialTab?: string
}

function PanelChangelog({ plugin }: { plugin: Plugin }) {
  const changelog = useReleasedDoc(plugin.changelogUrl, plugin.changelog)

  return (
    <div className="panel-body panel-doc">
      <Markdown source={changelog ?? ''} assets={docAssetsFor(plugin.id)} />
    </div>
  )
}

function PanelLog({ log, pluginName }: { log: InstallLog; pluginName: string }) {
  const { t } = useI18n()

  return (
    <div className="panel-body panel-log">
      <div className="panel-log-caption">{t('install.log.tab_caption', { name: pluginName })}</div>
      <InstallLogView log={log} />
    </div>
  )
}

// The status strips below the tab content: the persistent live install bar (any tab), and the
// post-install report / history shown on the overview tab.
function PanelZones({ activeTab, ops, activeLog, showOverviewLog, showHistoryZone, history, pluginName, onOpenRun }: {
  activeTab: DetailTab; ops: UsePluginOpsResult; activeLog?: InstallLog
  showOverviewLog: boolean; showHistoryZone: boolean; history?: PluginHistoryEntry[]; pluginName: string
  onOpenRun: () => void
}) {
  return (
    <>
      {activeTab === 'log' && activeLog && <PanelLog log={activeLog} pluginName={pluginName} />}
      {activeTab === 'overview' && showOverviewLog && (
        <InstallZone phase="idle" stepLabel="" log={activeLog ?? null} pluginName={pluginName} />
      )}
      {activeTab === 'overview' && showHistoryZone && history && (
        <HistoryZone history={history} pluginName={pluginName} />
      )}
      {ops.phase === 'working' && (
        <InstallZone phase="working" stepLabel={ops.stepLabel} log={null} pluginName={pluginName} onOpenLive={onOpenRun} />
      )}
    </>
  )
}

// The run modal auto-opens when an install starts and stays open through completion until the user
// dismisses it. Depending only on ops.phase means a mid-install close is not undone on re-render.
function useRunModalState(phase: UsePluginOpsResult['phase']): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (phase === 'working') setOpen(true) }, [phase])

  return [open, setOpen]
}

function PanelRunModal({ ops, open, pluginName, printerId, onClose }: {
  ops: UsePluginOpsResult; open: boolean; pluginName: string; printerId?: string; onClose: () => void
}) {
  if (!open || ops.phase === 'error' || (ops.phase !== 'working' && !ops.log)) return null

  return <InstallRunModal phase={ops.phase} steps={ops.steps} log={ops.log} pluginName={pluginName} printerId={printerId} onClose={onClose} />
}

// Live captures for the Captured tab: seed from the persisted history, then watch the daemon feed.
// Main pushes the full deduped list per event, so we just replace state. A plugin with no declared
// log (or not installed) is not watched.
function usePluginLog(printerId: string | undefined, plugin: Plugin, installed: boolean): string[] {
  const [captures, setCaptures] = useState<string[]>([])
  const enabled = installed && !!plugin.log
  const pluginId = plugin.id
  useEffect(() => {
    if (!enabled || !printerId) { setCaptures([]);

 return }
    window.b3d.store.pluginCaptures(printerId, pluginId).then(setCaptures).catch(() => setCaptures([]))
    window.b3d.store.watchPluginLog(printerId, pluginId)
    const unsubscribe = window.b3d.store.onPluginLog((event) => {
      if (event.printerId !== printerId || event.pluginId !== pluginId) return
      setCaptures(event.captures)
    })

    return () => {
      unsubscribe()
      window.b3d.store.unwatchPluginLog(printerId, pluginId)
    }
  }, [printerId, pluginId, enabled])

  return captures
}

// Owns the live-log watch so it runs only while the Captured tab is open (rendered only when the
// plugin declares a log and is installed).
function CapturedTab({ printerId, plugin, installed }: { printerId?: string; plugin: Plugin; installed: boolean }) {
  return <CapturesView captures={usePluginLog(printerId, plugin, installed)} />
}

// The Versions-tab selection state: which variant (registryUrl x channel) is chosen, defaulting to the
// installed-then-ceiling variant, plus the channel-chip picker that re-selects a channel's newest variant.
function useVariantSelection(plugin: Plugin, ceiling: ReleaseChannel, disabledChannels: ReleaseChannel[], installedSource: string | undefined, installedChannel: ReleaseChannel | undefined, onChannelPref?: (channel: ReleaseChannel) => void) {
  const defaultVariant = defaultSelectedVariant(plugin, ceiling, disabledChannels, installedSource, installedChannel)
  const [selectedKey, setSelectedKey] = useState(defaultVariant ? sourceKey(defaultVariant) : undefined)
  // The channel chips filter which source rows show (a view), independent of selectedKey (what installs).
  // 'all' shows every row; a specific channel both filters the rows and selects that channel's newest.
  const [channelFilter, setChannelFilter] = useState<ReleaseChannel | 'all'>('all')
  const selectedVariant = plugin.sources.find((source) => sourceKey(source) === selectedKey)
  function pickChannel(channel: ReleaseChannel | 'all') {
    setChannelFilter(channel)
    if (channel === 'all') return
    onChannelPref?.(channel)
    const variant = newestSourceOfChannel(plugin, channel)
    if (variant) setSelectedKey(sourceKey(variant))
  }

  return { selectedKey, setSelectedKey, selectedVariant, channelFilter, pickChannel }
}

function VersionsTab({ plugin, ceiling, selectedKey, channelFilter, installedSource, installedChannel, installedVersion, onPickChannel, onSelect, onRemoveLocal, t }: {
  plugin: Plugin; ceiling: ReleaseChannel; selectedKey?: string; channelFilter: ReleaseChannel | 'all'
  installedSource?: string; installedChannel?: ReleaseChannel; installedVersion?: string; onPickChannel: (channel: ReleaseChannel | 'all') => void
  onSelect: (key: string) => void; onRemoveLocal?: () => void; t: TFunction
}) {
  const shownSources = channelFilter === 'all' ? plugin.sources : plugin.sources.filter((source) => source.channel === channelFilter)

  return (
    <div className="panel-versions">
      <ChannelSelector plugin={plugin} ceiling={ceiling} channelFilter={channelFilter} onPick={onPickChannel} t={t} />
      <SourcesSection sources={shownSources} selected={selectedKey} installedSource={installedSource} installedChannel={installedChannel} installedVersion={installedVersion} onSelect={onSelect} onRemoveLocal={onRemoveLocal} t={t} />
    </div>
  )
}

export function PluginPanel({ plugin, printer, installed, deactivated, hasUpdate, printerId, printActive, blockedActions, daemonVersion, installedSource, installedVersion, installedChannel, primaryChannel, channelCeiling, disabledChannels, onChannelPref, allInstalledIds, savedPluginVars, onSaveVars, scopeFor, appliedVars, appliedVarsAt, onClose, onOperationDone, history, installedLog, initialTab }: PluginPanelProps) {
  const { t } = useI18n()
  const { plugins, refresh } = useCatalog()
  const localRemove = useLocalRemove(plugin.id, () => { refresh(); onClose() })
  const ceiling = channelCeiling ?? primaryChannel ?? 'stable'
  const { selectedKey, setSelectedKey, selectedVariant, channelFilter, pickChannel } = useVariantSelection(plugin, ceiling, disabledChannels ?? [], installedSource, installedChannel, onChannelPref)
  const multiFields = plugin.config
  const configState = usePanelConfigState({ plugin, plugins, installed, installedIds: allInstalledIds ?? [], savedVars: savedPluginVars, printerId, scopeFor, onSaveVars })
  const { multiVars, multiScopes, otherUiPorts, makePrimary } = configState
  // A deep link can request a starting tab; else on an update open straight to the changelog so the
  // user sees what changed before updating. An unavailable tab is corrected by the activeTab guard.
  const [tab, setTab] = useState<DetailTab>((initialTab as DetailTab) ?? (hasUpdate && hasReleaseNotes(plugin) ? 'changelog' : 'overview'))
  const installVars = multiFields ? multiVars : undefined
  const portError = httpPortError(multiFields ?? [], installVars ?? {}, otherUiPorts)
  const missingDeps = resolveMissingDeps(plugins, plugin.id, allInstalledIds ?? [])
  const dependents = installed ? installedDependents(plugins, plugin.id, allInstalledIds ?? []) : []
  const conflicts = installed ? [] : installedConflicts(plugins, plugin.id, allInstalledIds ?? [])
  const { block, canInstall } = installGate(t, plugin, { multiVars, printerId, conflicts, portError, printActive: !!printActive, blockedActions: blockedActions ?? [] })
  const needsNewerDaemon = !!plugin.minDaemonVersion && !isDaemonVersionAtLeast(daemonVersion ?? '0.0.0', plugin.minDaemonVersion)
  // A completed install persists the vars it sent into the preference store (under each field's
  // chosen scope), so the next printer's form starts from what the user actually picked.
  function handleOperationDone(ids: string[], pluginId: string, action: 'install' | 'uninstall', log?: InstallLog) {
    if (action === 'install' && pluginId === plugin.id) configState.persistInstallVars()
    onOperationDone?.(ids, pluginId, action, log)
  }
  const ops = usePluginOps(handleOperationDone)
  const [runOpen, setRunOpen] = useRunModalState(ops.phase)
  const actions = usePanelActions({ ops, printerId, pluginId: plugin.id, installVars, missingDeps, dependents, needsNewerDaemon, selectedSource: selectedVariant?.registryUrl, selectedChannel: selectedVariant?.channel })
  const switching = isSwitchingVariant(installed, selectedVariant, installedSource, installedChannel, installedVersion)
  const lastInstallEntry = [...(history ?? [])].reverse().find((historyEntry) => historyEntry.action === 'install')
  // sessionLog is this session's fresh install (drives the one-off "View report" strip on overview);
  // activeLog adds the persisted log so the Log TAB still has content after an app restart.
  const sessionLog = ops.log ?? lastInstallEntry?.log
  const activeLog = sessionLog ?? installedLog
  const hasLog = installed && activeLog != null
  const showHistoryZone = !installed && (history?.length ?? 0) > 0 && ops.phase === 'idle'
  const tabs = detailTabs(plugin, hasLog, installed && !!plugin.log, installed, installedVersion, installedSource)
  // Keep the tabs through an install (was hidden while working, which made Doc/Config vanish); the
  // live status is shown as its own persistent strip below, so it does not need the overview tab.
  const showTabs = tabs.length > 1
  const activeTab: DetailTab = showTabs && tabs.includes(tab) ? tab : 'overview'

  return (
    <>
      <Modal onClose={onClose} surfaceClassName="plugin-modal">
        <Button variant="ghost" icon className="panel-close" onClick={onClose} aria-label={t('btn.close')}><IconClose size={16} /></Button>
        <PanelHead plugin={plugin} installed={installed} deactivated={deactivated} hasUpdate={hasUpdate} installedVersion={installedVersion} />
        {showTabs && <PanelTabs tabs={tabs} active={activeTab} onTab={setTab} />}
        <div className="panel-scroll">
          {activeTab === 'overview' && <PanelBody plugin={plugin} missingDeps={missingDeps} installed={installed} />}
          {activeTab === 'versions' && (
            <VersionsTab plugin={plugin} ceiling={ceiling} selectedKey={selectedKey} channelFilter={channelFilter} installedSource={installedSource} installedChannel={installedChannel} installedVersion={installedVersion} onPickChannel={pickChannel} onSelect={setSelectedKey} onRemoveLocal={isSideloaded(plugin) ? localRemove.request : undefined} t={t} />
          )}
          {activeTab === 'doc' && <PanelDoc plugin={plugin} />}
          {activeTab === 'config' && (
            <PanelConfigArea
              plugin={plugin} installed={installed} printerId={printerId} printerSelected={!!printer} otherUiPorts={otherUiPorts}
              appliedVars={appliedVars} appliedVarsAt={appliedVarsAt} multiVars={multiVars}
              scopes={multiScopes} onScopeChange={configState.setFieldScope} onApplied={configState.saveConfigVars}
              onMultiVars={configState.setMultiVars} onMakePrimary={isUiPlugin(plugin) ? makePrimary : undefined}
            />
          )}
          {activeTab === 'changelog' && <PanelChangelog plugin={plugin} />}
          {activeTab === 'captured' && <CapturedTab printerId={printerId} plugin={plugin} installed={installed} />}
          <PanelZones
            activeTab={activeTab} ops={ops} activeLog={activeLog} showOverviewLog={installed && sessionLog != null && ops.phase === 'idle'}
            showHistoryZone={showHistoryZone} history={history} pluginName={plugin.title} onOpenRun={() => setRunOpen(true)}
          />
        </div>
        <PanelFoot
          ops={ops} installed={installed} hasUpdate={hasUpdate} switching={switching} canInstall={canInstall}
          orphan={isOrphan(plugin)} dependents={dependents} block={block} printActive={!!printActive}
          onInstall={() => nudgeInstall(plugin, activeTab, setTab, actions.requestInstall)} onUninstall={actions.uninstall}
          onConfigure={() => setTab('config')} onClose={onClose}
        />
      </Modal>
      <PanelGates plugin={plugin} printer={printer} ops={ops} daemonVersion={daemonVersion} dependents={dependents} actions={actions} localRemove={localRemove} onClose={onClose} />
      <PanelRunModal ops={ops} open={runOpen} pluginName={plugin.title} printerId={printerId} onClose={() => setRunOpen(false)} />
    </>
  )
}
