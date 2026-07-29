// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import type { AppSettings } from '../main/settings'

export const settingsApi = {
  get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),
}
