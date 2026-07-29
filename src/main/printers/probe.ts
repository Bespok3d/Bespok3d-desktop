// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createConnection } from 'net'
import type { ConnectionReach } from './record'

// One TCP liveness probe. `refusedMeansUp` flips the meaning of a refused connection: for a coarse
// host-reachability ping a refusal still proves the host is there, but for "is this service serving"
// a refusal means closed.
function probePort(ip: string, port: number, timeoutMs: number, refusedMeansUp = false): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: ip, port, timeout: timeoutMs })
    socket.on('connect', () => { socket.destroy(); resolve(true) })
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
    socket.on('error', (error: NodeJS.ErrnoException) => resolve(refusedMeansUp && error.code === 'ECONNREFUSED'))
  })
}

export function pingPrinter(ip: string): Promise<boolean> { return probePort(ip, 80, 1000, true) }

export function checkDaemon(ip: string): Promise<boolean> { return probePort(ip, 4269, 3000) }

// True when SSH (port 22) accepts a connection. Enrollment and repair are all SSH, so an open port 22
// means we can still fix or enroll the printer; a closed one means root access is off.
export function checkSshOpen(ip: string): Promise<boolean> { return probePort(ip, 22, 3000) }

// Moonraker (7125) answering is the strong "this address is really the printer" signal, not the bare
// web port: a DHCP lease moves, the printer's old IP gets handed to some random LAN device, and that
// device answers port 80 (smart plugs, routers, NAS boxes all do) but never Moonraker. Grading on
// Moonraker keeps a recycled-IP stranger from reading as our printer-alive-but-root-off.
export function checkMoonraker(ip: string): Promise<boolean> { return probePort(ip, 7125, 1500) }

// Grade a printer whose daemon did not answer: SSH up means we can still repair (a known printer) or
// enroll (a new one); Moonraker up but no SSH means it is alive but root access is off; neither means
// we cannot confirm the printer at this address (it may be unreachable, or its lease moved and the IP
// now belongs to another device), so it is offline rather than a falsely-confident alive-no-ssh.
export function gradeReach(moonrakerOpen: boolean, sshOpen: boolean): ConnectionReach {
  if (sshOpen) return 'recoverable'
  if (moonrakerOpen) return 'alive-no-ssh'

  return 'offline'
}
