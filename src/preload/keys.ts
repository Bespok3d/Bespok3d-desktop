// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import type { KeyRecord, GenerateKeyOptions, KeyAssignment } from '@bespok3d/contract'

export const keysApi = {
  list: (): Promise<KeyRecord[]> => ipcRenderer.invoke('keys:list'),
  generate: (opts: GenerateKeyOptions): Promise<KeyRecord> =>
    ipcRenderer.invoke('keys:generate', opts),
  remove: (id: string): Promise<void> => ipcRenderer.invoke('keys:remove', id),
  export: (id: string): Promise<string> => ipcRenderer.invoke('keys:export', id),
  exportPrivate: (id: string): Promise<string> => ipcRenderer.invoke('keys:exportPrivate', id),
  setDefault: (id: string): Promise<void> => ipcRenderer.invoke('keys:setDefault', id),
  setAssignments: (id: string, assignments: KeyAssignment[]): Promise<void> =>
    ipcRenderer.invoke('keys:setAssignments', id, assignments),
  setIcon: (id: string, color?: string, image?: string, size?: number): Promise<void> =>
    ipcRenderer.invoke('keys:setIcon', id, color, image, size),
  setPublishedAt: (id: string, date: string | null): Promise<void> =>
    ipcRenderer.invoke('keys:setPublishedAt', id, date),
}
