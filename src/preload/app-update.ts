// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import { subscribe } from './subscribe'
import type { RollbackResult } from '../main/app-update'
import type { UpdateErrorPayload } from '../main/app-update/problem'
import { updateStrategyForPlatform, type UpdateAvailablePayload, type AppReleaseListing } from '../main/app-update/view'

export const appUpdateApi = {
  canAutoInstall: updateStrategyForPlatform(process.platform, process.env.FLATPAK_ID) === 'autoInstall',
  installNow: (): Promise<void> => ipcRenderer.invoke('app-update:installNow'),
  openDownload: (url: string): Promise<void> => ipcRenderer.invoke('app-update:openDownload', url),
  checkNow: (): Promise<void> => ipcRenderer.invoke('app-update:checkNow'),
  download: (): Promise<void> => ipcRenderer.invoke('app-update:download'),
  reconfigure: (): Promise<void> => ipcRenderer.invoke('app-update:reconfigure'),
  listReleases: (): Promise<AppReleaseListing> => ipcRenderer.invoke('app-update:listReleases'),
  rollback: (tag: string): Promise<RollbackResult> => ipcRenderer.invoke('app-update:rollback', tag),
  consumeApplied: (): Promise<string | null> => ipcRenderer.invoke('app-update:consumeApplied'),
  onUpdateAvailable: (callback: (payload: UpdateAvailablePayload) => void): (() => void) =>
    subscribe('app-update:available', callback),
  onUpToDate: (callback: (version: string) => void): (() => void) =>
    subscribe('app-update:none', callback),
  onDownloadProgress: (callback: (percent: number) => void): (() => void) =>
    subscribe('app-update:progress', callback),
  onUpdateDownloaded: (callback: (version: string) => void): (() => void) =>
    subscribe('app-update:downloaded', callback),
  onUpdateError: (callback: (payload: UpdateErrorPayload) => void): (() => void) =>
    subscribe('app-update:error', callback),
  onOpenSettings: (callback: () => void): (() => void) =>
    subscribe('app-update:open-settings', callback),
}
