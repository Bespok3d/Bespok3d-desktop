// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import type { PrinterReach } from '../main/daemon-client/client'

export const netApi = {
  // True when something answers at that host and port from this computer. Used to tell a person
  // their typed address is good before it is written to a printer.
  probeService: (host: string, port: number): Promise<boolean> =>
    ipcRenderer.invoke('net:probeService', host, port),

  // The printer tries the whole address as typed, protocol and all, because the printer is where a
  // plugin will use it. The answer carries the http code, null when nothing answered the printer,
  // or says the printer could not be asked at all.
  askPrinterToReach: (printerId: string, address: string): Promise<PrinterReach> =>
    ipcRenderer.invoke('net:askPrinterToReach', printerId, address),
}
