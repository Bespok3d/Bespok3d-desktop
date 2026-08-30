// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import { subscribe } from './subscribe'
import type { ReleaseChannel } from '../main/settings'
import type { CapabilitiesResult, InstallLog } from '@bespok3d/contract'
import type { BatchResult } from '../main/daemon-client/batch-result'
import type { PluginProgressEvent } from '../main/ipc'
import type { PluginLogPush } from '../main/daemon-client/feeds/plugin-log'
import type { BatchProgressEvent, UploadProgressEvent } from '../main/daemon-client/feeds/install-progress'

export const storeApi = {
  capabilities: (printerId: string): Promise<CapabilitiesResult> =>
    ipcRenderer.invoke('store:capabilities', printerId),
  install: (printerId: string, pluginId: string, vars?: Record<string, string>, depIds?: string[], sourceUrl?: string, channel?: ReleaseChannel): Promise<{ installedIds: string[]; log: InstallLog }> =>
    ipcRenderer.invoke('store:install', printerId, pluginId, vars, depIds, sourceUrl, channel),
  uninstall: (printerId: string, pluginId: string, cascade?: boolean): Promise<string[]> =>
    ipcRenderer.invoke('store:uninstall', printerId, pluginId, cascade),
  reconfigure: (printerId: string, pluginId: string, vars: Record<string, string>): Promise<{ installedIds: string[]; log: InstallLog }> =>
    ipcRenderer.invoke('store:reconfigure', printerId, pluginId, vars),
  pluginConfig: (printerId: string, pluginId: string): Promise<Record<string, string> | null> =>
    ipcRenderer.invoke('store:pluginConfig', printerId, pluginId),
  recover: (printerId: string): Promise<BatchResult> =>
    ipcRenderer.invoke('store:recover', printerId),
  updateBatch: (printerId: string, updates: Array<{ pluginId: string; vars?: Record<string, string>; depIds?: string[]; sourceUrl?: string; channel?: ReleaseChannel }>): Promise<BatchResult> =>
    ipcRenderer.invoke('store:update-batch', printerId, updates),
  installBatch: (printerId: string, specs: Array<{ pluginId: string; vars?: Record<string, string>; depIds?: string[]; sourceUrl?: string; channel?: ReleaseChannel }>): Promise<BatchResult> =>
    ipcRenderer.invoke('store:install-batch', printerId, specs),
  uninstallBatch: (printerId: string, pluginIds: string[], cascade: boolean): Promise<BatchResult> =>
    ipcRenderer.invoke('store:uninstall-batch', printerId, pluginIds, cascade),
  onPluginProgress: (callback: (event: PluginProgressEvent) => void): (() => void) =>
    subscribe('store:plugin:progress', callback),
  onBatchProgress: (callback: (payload: { printerId: string; event: BatchProgressEvent }) => void): (() => void) =>
    subscribe('store:batchProgress', callback),
  onUploadProgress: (callback: (event: UploadProgressEvent) => void): (() => void) =>
    subscribe('store:uploadProgress', callback),
  watchPluginLog: (printerId: string, pluginId: string): Promise<void> =>
    ipcRenderer.invoke('store:watchPluginLog', printerId, pluginId),
  unwatchPluginLog: (printerId: string, pluginId: string): Promise<void> =>
    ipcRenderer.invoke('store:unwatchPluginLog', printerId, pluginId),
  pluginCaptures: (printerId: string, pluginId: string): Promise<string[]> =>
    ipcRenderer.invoke('store:pluginCaptures', printerId, pluginId),
  onPluginLog: (callback: (event: PluginLogPush) => void): (() => void) =>
    subscribe('store:pluginLog', callback),
}
