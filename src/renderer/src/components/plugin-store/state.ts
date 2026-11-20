// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect, useRef } from 'react'
import type { Plugin, Printer, ReleaseChannel } from '../../data/types'
import type { CeilingResolver } from '../../data/channels'
import { applyToId } from '../../data/printers'
import { refreshInstallProvenance } from './install-provenance'
import { useI18n } from '../../i18n/context'
import type { PluginPageView, TabRequest } from './detail/StoreDetailPanel'
import { batchBlockReason } from './batch-gate'
import type { InstallBlock } from './panel/install-gate'
import type { Collection } from '../../data/collections'
import type { UpdateAllPlan } from './migrations'
import { buildUpdatePlan, updateAllCount, planIsEmpty } from './migrations'
import { installedFromRecords } from '../../data/channels/updates'
import { autoRecoveryNotice } from './safety/notice'
import type { SafetyNotice } from './safety/notice'

type OnPrinterUpdate = (updater: (prev: Printer[]) => Printer[]) => void

// One entry in a plugin's in-session install/uninstall history. A renderer-only concept (the store
// keeps it while the view is mounted), so it lives here, not in the app<->daemon contract.
export interface PluginHistoryEntry {
  pluginId: string
  action: 'install' | 'uninstall'
  timestamp: number
  log?: InstallLog
}

// The history with one more entry on the end of that plugin's list, as a new map: React only re-renders
// on a new object, so the map held in state is never mutated in place.
function withHistoryEntry(history: Map<string, PluginHistoryEntry[]>, entry: PluginHistoryEntry): Map<string, PluginHistoryEntry[]> {
  const next = new Map(history)
  next.set(entry.pluginId, [...(history.get(entry.pluginId) ?? []), entry])

  return next
}

export function useInstallState(printer: Printer | null | undefined, onPrinterUpdate: OnPrinterUpdate | undefined, batchBusy: boolean) {
  const [liveInstalledIds, setLiveInstalledIds] = useState<string[] | null>(null)
  const [liveInstalledVersions, setLiveInstalledVersions] = useState<Record<string, string> | null>(null)
  const [liveDeactivatedIds, setLiveDeactivatedIds] = useState<string[] | null>(null)
  const [pluginHistory, setPluginHistory] = useState<Map<string, PluginHistoryEntry[]>>(new Map())
  const [safetyNotice, setSafetyNotice] = useState<SafetyNotice | null>(null)
  const wasBatchBusy = useRef(false)
  function refreshCapabilities() {
    if (printer?.status !== 'managed' || !printer.id) {
      setLiveInstalledIds(null)
      setLiveInstalledVersions(null)

      return
    }
    const printerId = printer.id
    refreshInstallProvenance(printerId, onPrinterUpdate)
    window.b3d.store.capabilities(printerId)
      .then((caps) => {
        setLiveInstalledIds(Object.keys(caps.installed))
        setLiveInstalledVersions(caps.installed)
        setLiveDeactivatedIds(caps.deactivated ?? [])
        onPrinterUpdate?.(applyToId(printerId, { endpoints: caps.endpoints, installedVersions: caps.installed, installedFingerprints: caps.installed_fingerprints ?? {}, deactivatedIds: caps.deactivated ?? [] }))
      })
      // A failed live fetch must NOT blank the installed set: fall back to null so the selector uses
      // the last-known installed list from the printer record. Blanking to [] would hide every
      // installed plugin (showing them all as not-installed) on a transient daemon hiccup.
      .catch(() => { setLiveInstalledIds(null); setLiveInstalledVersions(null); setLiveDeactivatedIds(null) })
  }
  useEffect(refreshCapabilities, [printer?.id, printer?.status])
  // A batch op (install-selected / update-all / uninstall-batch) runs at the App level, so the store
  // never sees a per-plugin onOperationDone. Re-sync the live installed set when the batch settles
  // (busy true -> false), or the grid keeps the pre-batch state until a manual reload.
  function refreshLiveAfterBatch() {
    if (wasBatchBusy.current && !batchBusy) refreshCapabilities()
    wasBatchBusy.current = batchBusy
  }
  useEffect(refreshLiveAfterBatch, [batchBusy])
  function onOperationDone(ids: string[], pluginId: string, action: 'install' | 'uninstall', log?: InstallLog) {
    setLiveInstalledIds(ids)
    const entry: PluginHistoryEntry = { pluginId, action, timestamp: Date.now(), log }
    setPluginHistory((prev) => withHistoryEntry(prev, entry))
    const notice = autoRecoveryNotice(log)
    if (notice) setSafetyNotice(notice)
    refreshCapabilities()
  }

  return { liveInstalledIds, liveInstalledVersions, liveDeactivatedIds, pluginHistory, onOperationDone, safetyNotice, dismissSafetyNotice: () => setSafetyNotice(null) }
}

interface UpdateAllDeps {
  printerId?: string
  plugins: Plugin[]
  installedIds: string[]
  installedVersions: Record<string, string>
  installedSources: Record<string, string>
  // The build each installed copy came from, as the daemon names it; absent from an older daemon.
  installedFingerprints?: Record<string, string>
  savedVars: Record<string, string>
  ceilingFor: CeilingResolver
  disabledChannels: ReleaseChannel[]
  printActive: boolean
  blockedActions: string[]
  collections: Collection[]
  onUpdateAll?: (printerId: string, plan: UpdateAllPlan) => void
}

// Builds the batch update specs and hands them to the App-level handler, which runs a single
// daemon update-batch (one restart for the whole set) and shows the results modal. Updating every
// plugin at once is an automation of updating them one at a time, so it answers to the same gate:
// while the printer is printing there is no update-all, exactly as there is no single install.
export function useUpdateAll(deps: UpdateAllDeps): { updatableCount: number; updateBlock: InstallBlock | null; updateAll: () => void } {
  const { t } = useI18n()
  const installed = installedFromRecords(deps.installedVersions, deps.installedSources, deps.ceilingFor, deps.disabledChannels, deps.installedFingerprints)
  const plan = buildUpdatePlan(deps.plugins, deps.collections, deps.installedIds, installed, deps.savedVars)
  const updatableCount = updateAllCount(plan)
  const updateBlock = batchBlockReason(t, { printerId: deps.printerId, printActive: deps.printActive, blockedActions: deps.blockedActions })

  function updateAll(): void {
    if (!deps.printerId || !deps.onUpdateAll || planIsEmpty(plan) || updateBlock) return
    deps.onUpdateAll(deps.printerId, plan)
  }

  return { updatableCount, updateBlock, updateAll }
}

// A plugin page an outside caller asks the store to open, and the view it opens on when one is named.
interface PanelFocus {
  pluginId: string | null | undefined
  view: PluginPageView | null | undefined
}

// How the store opens a panel and asks it for a view (the panelPlugin/tabRequest setters it owns).
interface PanelOpener {
  open: (plugin: Plugin) => void
  requestTab: (next: (prev: TabRequest | null) => TabRequest) => void
}

// The bumped nonce re-applies the view even when the panel is already open on that plugin.
function openPanelOnView(target: Plugin, view: PluginPageView | null | undefined, opener: PanelOpener): void {
  opener.open(target)
  if (!view) return
  opener.requestTab((prev) => ({ ...view, id: target.id, nonce: (prev?.nonce ?? 0) + 1 }))
}

// Open a plugin's detail panel when an external focus is requested (e.g. drag-drop "install now", or an
// update notice naming the Versions tab), then clear the request so it fires once.
function useFocusPanel(focus: PanelFocus, plugins: Plugin[], opener: PanelOpener, onHandled: (() => void) | undefined): void {
  useEffect(() => {
    if (!focus.pluginId) return
    const target = plugins.find((plugin) => plugin.id === focus.pluginId)
    if (target) openPanelOnView(target, focus.view, opener)
    onHandled?.()
  }, [focus.pluginId, focus.view, plugins])
}

// The plugin whose detail panel is open, and the view it was asked to open on. Closing the panel or
// moving to another plugin ends that view, so the plugin's next open starts fresh rather than on the
// tab and variant a notice once named. A request for the same plugin is kept, so its nonce still counts up.
export function usePluginPanel(focus: PanelFocus, plugins: Plugin[], onFocusHandled: (() => void) | undefined) {
  const [panelPlugin, setPanelPlugin] = useState<Plugin | null>(null)
  const [tabRequest, setTabRequest] = useState<TabRequest | null>(null)
  useFocusPanel(focus, plugins, { open: selectPanelPlugin, requestTab: setTabRequest }, onFocusHandled)

  function selectPanelPlugin(plugin: Plugin | null) {
    setPanelPlugin(plugin)
    setTabRequest((request) => (request && request.id === plugin?.id ? request : null))
  }

  return { panelPlugin, tabRequest, selectPanelPlugin, requestTab: setTabRequest }
}
