// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import { subscribe } from './subscribe'
import type { PublicPrinterRecord } from '../main/printers'
import type { AdapterInfo } from '../main/adapter-loader'
import type { EnrollProgressEvent, SshCheckResult } from '../main/enrollment'
import type { PrintStateEvent } from '../main/daemon-client/feeds/print-state'

export const printersApi = {
  load: (): Promise<PublicPrinterRecord[]> => ipcRenderer.invoke('printers:load'),
  save: (rec: PublicPrinterRecord): Promise<void> => ipcRenderer.invoke('printers:save', rec),
  patch: (id: string, fields: Partial<PublicPrinterRecord>): Promise<void> =>
    ipcRenderer.invoke('printers:patch', id, fields),
  remove: (id: string): Promise<void> => ipcRenderer.invoke('printers:remove', id),
  ping: (ip: string): Promise<boolean> => ipcRenderer.invoke('printers:ping', ip),
  checkSshOpen: (ip: string): Promise<boolean> => ipcRenderer.invoke('printers:checkSshOpen', ip),
  checkWriteLayer: (printerId: string): Promise<boolean | null> => ipcRenderer.invoke('printers:checkWriteLayer', printerId),
  checkDaemon: (printerId: string): Promise<{ isManaged: boolean; reach: 'managed' | 'recoverable' | 'alive-no-ssh' | 'offline'; sshOpen: boolean; ip?: string; networkInterfaces?: Array<{ ip: string }>; daemonVersion?: string; daemonUpdateAvailable?: boolean; installedIds?: string[]; installedVersions?: Record<string, string> }> =>
    ipcRenderer.invoke('printers:checkDaemon', printerId),
  adapterGet: (id: string): Promise<AdapterInfo | null> =>
    ipcRenderer.invoke('printers:adapter:get', id),
  adaptersList: (): Promise<AdapterInfo[]> =>
    ipcRenderer.invoke('printers:adapters:list'),
  checkSsh: (ip: string, user: string, password: string, port: number): Promise<SshCheckResult> =>
    ipcRenderer.invoke('printers:checkSsh', ip, user, password, port),
  enroll: (printerId: string, ip: string, adapterId: string, user: string, password: string, port: number, retryFromStepId?: string): Promise<void> =>
    ipcRenderer.invoke('printers:enroll', printerId, ip, adapterId, user, password, port, retryFromStepId),
  // Stop the operation running on this printer at the next step boundary.
  cancelOp: (printerId: string): Promise<void> => ipcRenderer.invoke('printers:cancelOp', printerId),
  deactivate: (printerId: string, ip: string, user: string, password: string, port: number): Promise<void> =>
    ipcRenderer.invoke('printer:deactivate', printerId, ip, user, password, port),
  reactivate: (printerId: string, ip: string, user: string, password: string, port: number): Promise<void> =>
    ipcRenderer.invoke('printer:reactivate', printerId, ip, user, password, port),
  uninstall: (printerId: string, ip: string, user: string, password: string, port: number): Promise<void> =>
    ipcRenderer.invoke('printer:uninstall', printerId, ip, user, password, port),
  reboot: (printerId: string, ip: string, user: string, password: string, port: number): Promise<void> =>
    ipcRenderer.invoke('printer:reboot', printerId, ip, user, password, port),
  repair: (printerId: string, ip: string, user: string, password: string, port: number): Promise<void> =>
    ipcRenderer.invoke('printer:repair', printerId, ip, user, password, port),
  updateDaemon: (printerId: string, ip: string, user: string, password: string, port: number): Promise<void> =>
    ipcRenderer.invoke('printer:update-daemon', printerId, ip, user, password, port),
  updateJinni: (printerId: string, ip: string, user: string, password: string, port: number): Promise<void> =>
    ipcRenderer.invoke('printer:update-jinni', printerId, ip, user, password, port),
  resetAccess: (printerId: string, ip: string, user: string, password: string, port: number): Promise<void> =>
    ipcRenderer.invoke('printer:reset-access', printerId, ip, user, password, port),
  onEnrollProgress: (callback: (event: EnrollProgressEvent) => void): (() => void) =>
    subscribe('printers:enroll:progress', callback),
  watchPrintState: (printerId: string): Promise<void> =>
    ipcRenderer.invoke('printers:watchPrintState', printerId),
  unwatchPrintState: (printerId: string): Promise<void> =>
    ipcRenderer.invoke('printers:unwatchPrintState', printerId),
  onPrintState: (callback: (event: PrintStateEvent) => void): (() => void) =>
    subscribe('printer:printState', callback),
}
