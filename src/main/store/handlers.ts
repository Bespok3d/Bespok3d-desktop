// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcMain, type BrowserWindow } from 'electron'
import { updatePrinter, appendPluginCapture, pluginCaptures } from '../printers'
import type { ReleaseChannel } from '../settings'
import type { InstallLog, RecoverResult } from '@bespok3d/contract'
import { fetchCapabilities, fetchPluginConfig, reconfigurePlugin, recoverPackages } from '../daemon-client/client'
import { getManagedRecord, parseCaps, DAEMON_QUERY_TIMEOUT_MS } from '../daemon-client/status'
import { recordAppliedVars } from './record-sync'
import { watchPluginLog, unwatchPluginLog } from '../daemon-client/feeds/plugin-log'
import { sendProgress } from './progress'
import { installGuarded } from './install'
import { runStoreUninstall, runStoreUninstallBatch } from './uninstall'
import { runStoreUpdateBatch, runStoreInstallBatch, type PluginUpdateSpec } from './update-batch'
import { streamRecoverProgress } from './batch-progress'

function registerPluginLogHandlers(getMainWindow: () => BrowserWindow): void {
  ipcMain.handle('store:watchPluginLog', (_ev, printerId: string, pluginId: string) =>
    watchPluginLog(printerId, pluginId, (event) => {
      const captures = appendPluginCapture(event.printerId, event.pluginId, event.value)
      const win = getMainWindow()
      if (win && !win.isDestroyed()) win.webContents.send('store:pluginLog', { ...event, captures })
    })
  )
  ipcMain.handle('store:unwatchPluginLog', (_ev, printerId: string, pluginId: string) =>
    unwatchPluginLog(printerId, pluginId),
  )
  ipcMain.handle('store:pluginCaptures', (_ev, printerId: string, pluginId: string) =>
    pluginCaptures(printerId, pluginId),
  )
}

function registerBatchHandlers(getMainWindow: () => BrowserWindow): void {
  ipcMain.handle('store:update-batch', (_ev, printerId: string, updates: PluginUpdateSpec[]) =>
    runStoreUpdateBatch(getMainWindow(), printerId, updates),
  )

  ipcMain.handle('store:install-batch', (_ev, printerId: string, specs: PluginUpdateSpec[]) =>
    runStoreInstallBatch(getMainWindow(), printerId, specs),
  )

  ipcMain.handle('store:uninstall-batch', (_ev, printerId: string, pluginIds: string[], cascade: boolean) =>
    runStoreUninstallBatch(printerId, pluginIds, cascade),
  )
}

export function registerStoreHandlers(getMainWindow: () => BrowserWindow): void {
  registerPluginLogHandlers(getMainWindow)
  registerBatchHandlers(getMainWindow)
  ipcMain.handle('store:capabilities', async (_ev, printerId: string) => {
    const record = getManagedRecord(printerId)
    const caps = await fetchCapabilities(record)
    const parsed = parseCaps(caps, record)
    updatePrinter(printerId, parsed)

    return { ...caps, installed: parsed.installedVersions, endpoints: parsed.endpoints }
  })

  ipcMain.handle(
    'store:install',
    (_ev, printerId: string, pluginId: string, vars?: Record<string, string>, depIds?: string[], sourceUrl?: string, channel?: ReleaseChannel) =>
      installGuarded(getMainWindow(), printerId, pluginId, vars, depIds, sourceUrl, channel),
  )

  ipcMain.handle('store:uninstall', (_ev, printerId: string, pluginId: string, cascade?: boolean) =>
    runStoreUninstall(getMainWindow(), printerId, pluginId, cascade),
  )

  ipcMain.handle('store:reconfigure', async (_ev, printerId: string, pluginId: string, vars: Record<string, string>) => {
    const win = getMainWindow()
    const record = getManagedRecord(printerId)
    sendProgress(win, printerId, pluginId, 'Updating config on printer…')
    const log: InstallLog = await reconfigurePlugin(record, pluginId, vars)
    sendProgress(win, printerId, pluginId, 'Refreshing…')
    const parsed = parseCaps(await fetchCapabilities(record), record)
    updatePrinter(printerId, (current) => ({ ...parsed, ...recordAppliedVars(current, pluginId, vars, new Date().toISOString()) }))

    return { installedIds: parsed.installedIds, log }
  })

  // The Config tab's tier-1 truth read: the vars the daemon persisted for this plugin, null when the
  // daemon cannot vouch for one (unknown plugin, or a pre-0.12.12 daemon without the route).
  ipcMain.handle('store:pluginConfig', (_ev, printerId: string, pluginId: string) =>
    fetchPluginConfig(getManagedRecord(printerId), pluginId, DAEMON_QUERY_TIMEOUT_MS),
  )

  // The live feed is opened (and awaited) before the call, as a batch does, so the user watches
  // recovery name each plugin it puts back instead of waiting on a spinner.
  ipcMain.handle('store:recover', async (_ev, printerId: string): Promise<RecoverResult> => {
    const record = getManagedRecord(printerId)
    const closeProgress = await streamRecoverProgress(getMainWindow(), printerId, record)

    return recoverPackages(record).finally(closeProgress)
  })
}
