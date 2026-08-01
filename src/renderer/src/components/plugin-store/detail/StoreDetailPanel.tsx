// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, Printer, PluginConfigField } from '../../../data/types'
import type { PluginVarsSave, ScopeChoice } from '../../../data/plugin-vars'
import type { B3dEntityRef } from '../../../data/b3d-ref'
import type { PluginHistoryEntry } from '../state'
import type { ChannelPrefs } from '../../common/hooks/useChannelPrefs'
import { hasUpdate, installedFromRecords } from '../../../data/channels/updates'
import { B3dRefProvider } from '../../common/content/Markdown'
import { PluginPanel } from '../panel'

// A request to open the panel on a specific detail tab, scoped to one plugin id. The nonce makes a
// repeat request re-apply even when the panel is already open on that plugin (it remounts via key).
export interface TabRequest {
  id: string
  tab: string
  nonce: number
}

// Resolve a b3d:// doc link to a catalog plugin and open its panel, optionally on the tab named in
// the link's #fragment (e.g. b3d://bespok3d/octoeverywhere#captured opens the Captured output tab).
function openDocRef(
  ref: B3dEntityRef,
  plugins: Plugin[],
  open: (plugin: Plugin) => void,
  requestTab: (next: (prev: TabRequest | null) => TabRequest) => void,
): void {
  const target = plugins.find((plugin) => plugin.id === ref.name)
  if (!target) return
  open(target)
  if (!ref.tab) return
  const tab = ref.tab
  requestTab((prev) => ({ id: target.id, tab, nonce: (prev?.nonce ?? 0) + 1 }))
}

interface DetailPanelInputs {
  plugin: Plugin
  printer?: Printer | null
  view: { installedIds: string[]; installedVersions: Record<string, string>; deactivatedIds: string[] }
  channelPrefs: ChannelPrefs
  printActive: boolean
  blockedActions: string[]
  savedPluginVars?: Record<string, string>
  onSaveVars?: (save: PluginVarsSave) => void
  scopeFor?: (field: PluginConfigField) => ScopeChoice
  onOperationDone: (ids: string[], pluginId: string, action: 'install' | 'uninstall', log?: InstallLog) => void
  history?: PluginHistoryEntry[]
  catalogPlugins: Plugin[]
  tabRequest: TabRequest | null
  onSelectPlugin: (plugin: Plugin | null) => void
  onTabRequest: (next: (prev: TabRequest | null) => TabRequest) => void
}

// The open plugin's detail modal, driven by the panelPlugin/tabRequest state PluginStore owns. hasUpdate
// + the channel props are all resolved through the user's stability ceiling.
export function StoreDetailPanel({ plugin, printer, view, channelPrefs, printActive, blockedActions, savedPluginVars, onSaveVars, scopeFor, onOperationDone, history, catalogPlugins, tabRequest, onSelectPlugin, onTabRequest }: DetailPanelInputs) {
  const { primary, disabledChannels, ceilingFor, setPref } = channelPrefs
  const installedVersion = view.installedVersions[plugin.id]
  const installed = installedFromRecords(view.installedVersions, printer?.installedSources, ceilingFor, disabledChannels)

  return (
    <B3dRefProvider onRef={(ref) => openDocRef(ref, catalogPlugins, onSelectPlugin, onTabRequest)}>
      <PluginPanel
        key={`${plugin.id}:${tabRequest?.id === plugin.id ? tabRequest.nonce : 0}`} initialTab={tabRequest?.id === plugin.id ? tabRequest.tab : undefined}
        plugin={plugin} printer={printer}
        installed={view.installedIds.includes(plugin.id)}
        deactivated={view.deactivatedIds.includes(plugin.id)}
        hasUpdate={hasUpdate(plugin, installed)}
        printerId={printer?.status === 'managed' ? printer.id : undefined}
        printActive={printActive} blockedActions={blockedActions} daemonVersion={printer?.daemonVersion}
        installedSource={printer?.installedSources?.[plugin.id]}
        installedVersion={installedVersion}
        installedChannel={printer?.installedChannels?.[plugin.id]}
        primaryChannel={primary} channelCeiling={ceilingFor(plugin.id)} disabledChannels={disabledChannels}
        onChannelPref={(channel) => setPref(plugin.id, channel)}
        allInstalledIds={view.installedIds}
        savedPluginVars={savedPluginVars} onSaveVars={onSaveVars} scopeFor={scopeFor}
        appliedVars={printer?.appliedPluginVars?.[plugin.id]} appliedVarsAt={printer?.appliedPluginVarsAt?.[plugin.id]}
        onClose={() => onSelectPlugin(null)} onOperationDone={onOperationDone} history={history}
        installedLog={printer?.installLogs?.[plugin.id]}
      />
    </B3dRefProvider>
  )
}
