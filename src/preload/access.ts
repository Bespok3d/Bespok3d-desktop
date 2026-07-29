// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import type { AccessClients } from '../main/daemon-client/client'

export const accessApi = {
  request: (printerId: string, label: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('access:request', printerId, label),
  status: (printerId: string): Promise<'pending' | 'granted'> =>
    ipcRenderer.invoke('access:status', printerId),
  clients: (printerId: string): Promise<AccessClients> =>
    ipcRenderer.invoke('access:clients', printerId),
  grant: (printerId: string, identity: string): Promise<void> =>
    ipcRenderer.invoke('access:grant', printerId, identity),
  revoke: (printerId: string, identity: string): Promise<void> =>
    ipcRenderer.invoke('access:revoke', printerId, identity),
}
