// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'

export const netApi = {
  // True when something answers at that host and port from this computer. Used to tell a person
  // their typed address is good before it is written to a printer.
  probeService: (host: string, port: number): Promise<boolean> =>
    ipcRenderer.invoke('net:probeService', host, port),

  // The http code the whole address as typed answers with, protocol and all, or null when nothing
  // answers. Separate from probeService because a name behind a certificate needs the request, not
  // just the open socket, and because the code itself is worth showing.
  probeServiceUrl: (address: string): Promise<number | null> =>
    ipcRenderer.invoke('net:probeServiceUrl', address),
}
