// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import type { UploadProgressEvent } from '../daemon-client/feeds/install-progress'

export interface PluginProgressEvent {
  printerId: string
  pluginId: string
  message: string
}

export function sendProgress(win: BrowserWindow, printerId: string, pluginId: string, message: string): void {
  win.webContents.send('store:plugin:progress', { printerId, pluginId, message } as PluginProgressEvent)
}

export function sendUpload(win: BrowserWindow, printerId: string, sent: number, total: number): void {
  if (!win.isDestroyed()) win.webContents.send('store:uploadProgress', { printerId, sent, total } as UploadProgressEvent)
}
