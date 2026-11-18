// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The window's door to a printer's active watch: the live feed and the setting.
import { ipcMain, type BrowserWindow } from 'electron'
import { getManagedRecord } from './status'
import { watchActiveWatch, unwatchActiveWatch } from './feeds/active-watch'
import type { ActiveWatchEvent } from './feeds/active-watch'
import { fetchActiveWatchSetting, saveActiveWatchSetting } from './active-watch-client'
import type { ActiveWatchSetting } from './active-watch-client'

function sendToWindow(getMainWindow: () => BrowserWindow, channel: string, payload: ActiveWatchEvent): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function watchForWindow(getMainWindow: () => BrowserWindow, printerId: string): void {
  watchActiveWatch(printerId, (event) => sendToWindow(getMainWindow, 'printer:activeWatch', event))
}

export function registerActiveWatchHandlers(getMainWindow: () => BrowserWindow): void {
  ipcMain.handle('printers:watchActiveWatch', (_ev, printerId: string) => watchForWindow(getMainWindow, printerId))
  ipcMain.handle('printers:unwatchActiveWatch', (_ev, printerId: string) => unwatchActiveWatch(printerId))
  ipcMain.handle('printers:activeWatchSetting', (_ev, printerId: string) =>
    fetchActiveWatchSetting(getManagedRecord(printerId)))
  ipcMain.handle('printers:saveActiveWatchSetting', (_ev, printerId: string, setting: ActiveWatchSetting) =>
    saveActiveWatchSetting(getManagedRecord(printerId), setting))
}
