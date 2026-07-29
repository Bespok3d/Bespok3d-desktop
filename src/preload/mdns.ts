// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import { subscribe } from './subscribe'
import type { DiscoveredPrinterRecord } from '../main/mdns'

export const mdnsApi = {
  start: (): Promise<void> => ipcRenderer.invoke('mdns:start'),
  stop: (): Promise<void> => ipcRenderer.invoke('mdns:stop'),
  onFound: (callback: (printer: DiscoveredPrinterRecord) => void): (() => void) =>
    subscribe('mdns:found', callback),
}
