// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect, useRef } from 'react'
import type { Plugin, Printer, ReleaseChannel } from '../../data/types'
import type { CeilingResolver } from '../../data/channels'
import { applyToId } from '../../data/printers'
import { refreshInstallProvenance } from './install-provenance'
import { useI18n } from '../../i18n/context'
import { batchBlockReason } from './batch-gate'
import type { InstallBlock } from './panel/install-gate'
import { updatablePlugins, buildUpdateSpecs } from './update-all'
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
        onPrinterUpdate?.(applyToId(printerId, { endpoints: caps.endpoints, installedVersions: caps.installed, deactivatedIds: caps.deactivated ?? [] }))
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
  savedVars: Record<string, string>
  ceilingFor: CeilingResolver
  disabledChannels: ReleaseChannel[]
  printActive: boolean
  blockedActions: string[]
  onUpdateAll?: (printerId: string, updates: PluginUpdateSpec[]) => void
}

// Builds the batch update specs and hands them to the App-level handler, which runs a single
// daemon update-batch (one restart for the whole set) and shows the results modal. Updating every
// plugin at once is an automation of updating them one at a time, so it answers to the same gate:
// while the printer is printing there is no update-all, exactly as there is no single install.
export function useUpdateAll(deps: UpdateAllDeps): { updatableCount: number; updateBlock: InstallBlock | null; updateAll: () => void } {
  const { t } = useI18n()
  const installed = installedFromRecords(deps.installedVersions, deps.installedSources, deps.ceilingFor, deps.disabledChannels)
  const updatableCount = updatablePlugins(deps.plugins, installed).length
  const updateBlock = batchBlockReason(t, { printerId: deps.printerId, printActive: deps.printActive, blockedActions: deps.blockedActions })

  function updateAll(): void {
    if (!deps.printerId || !deps.onUpdateAll || updatableCount === 0 || updateBlock) return
    deps.onUpdateAll(deps.printerId, buildUpdateSpecs(deps.plugins, deps.installedIds, installed, deps.savedVars))
  }

  return { updatableCount, updateBlock, updateAll }
}

// Open a plugin's detail panel when an external focus is requested (e.g. drag-drop "install now"),
// then clear the request so it fires once.
export function useFocusPanel(
  focusPluginId: string | null | undefined,
  plugins: Plugin[],
  open: (plugin: Plugin) => void,
  onHandled: (() => void) | undefined,
): void {
  useEffect(() => {
    if (!focusPluginId) return
    const target = plugins.find((plugin) => plugin.id === focusPluginId)
    if (target) open(target)
    onHandled?.()
  }, [focusPluginId, plugins])
}
