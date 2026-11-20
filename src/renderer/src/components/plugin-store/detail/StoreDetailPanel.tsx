// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, Printer, PluginConfigField } from '../../../data/types'
import { managedPrinterId } from '../../../data/printers'
import type { PluginVarsSave, ScopeChoice } from '../../../data/plugin-vars'
import type { B3dEntityRef } from '../../../data/b3d-ref'
import type { PluginHistoryEntry } from '../state'
import type { ChannelPrefs } from '../../common/hooks/useChannelPrefs'
import { hasUpdate, installedFromRecords, updateVariant } from '../../../data/channels/updates'
import type { InstalledOnPrinter } from '../../../data/channels/updates'
import { sourceKey } from '../panel/tabs/sources'
import { B3dRefProvider } from '../../common/content/Markdown'
import { PluginPanel } from '../panel'

// Where a plugin's page opens: a detail tab, and on the Versions tab optionally a variant (a sourceKey)
// already selected, as an update notice from another list asks.
export interface PluginPageView {
  tab: string
  variantKey?: string
}

// A request to open the panel on a specific view, scoped to one plugin id. The nonce makes a repeat
// request re-apply even when the panel is already open on that plugin (it remounts via key).
export interface TabRequest extends PluginPageView {
  id: string
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

// The variant an update would install, so the panel opens on it and its Update button installs that
// build rather than the installed one again. Undefined when nothing is offered.
function offeredVariantKey(plugin: Plugin, installed: InstalledOnPrinter): string | undefined {
  const offered = hasUpdate(plugin, installed) ? updateVariant(plugin, installed) : undefined

  return offered && sourceKey(offered)
}

// The variant the panel opens on: the one a notice named while the plugin still offers it, else the
// offered update, so a notice built from an older catalog never falls back to the installed copy.
function openingVariantKey(plugin: Plugin, installed: InstalledOnPrinter, requestedKey: string | undefined): string | undefined {
  const stillOffered = plugin.sources.some((source) => sourceKey(source) === requestedKey)

  return stillOffered ? requestedKey : offeredVariantKey(plugin, installed)
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
  const installed = installedFromRecords(view.installedVersions, printer?.installedSources, ceilingFor, disabledChannels, printer?.installedFingerprints)
  const request = tabRequest?.id === plugin.id ? tabRequest : null

  return (
    <B3dRefProvider onRef={(ref) => openDocRef(ref, catalogPlugins, onSelectPlugin, onTabRequest)}>
      <PluginPanel
        key={`${plugin.id}:${request?.nonce ?? 0}`} initialTab={request?.tab} initialVariantKey={openingVariantKey(plugin, installed, request?.variantKey)}
        plugin={plugin} printer={printer}
        installed={view.installedIds.includes(plugin.id)}
        deactivated={view.deactivatedIds.includes(plugin.id)}
        hasUpdate={hasUpdate(plugin, installed)}
        printerId={managedPrinterId(printer)}
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
