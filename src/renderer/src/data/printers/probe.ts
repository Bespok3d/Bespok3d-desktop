// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer, ConnectionReach, PrinterConnection } from '../types'
import type { DaemonMetadata } from '@bespok3d/contract'
import { applyToId, type SetPrinters } from './list'
import { statusAfterProbe, type ProbeStatus } from './status'

interface DaemonResult extends DaemonMetadata {
  isManaged: boolean
  // What the printer runs of bespok3d itself (the daemon, this printer's jinni). Not part of the
  // plugin list, so nothing else here would know either one is on the printer at all.
  machineryVersions?: Record<string, string>
  reach?: ConnectionReach
  sshOpen?: boolean
  ip?: string
  networkInterfaces?: Array<{ label?: string; ip: string }>
}

// A reachable daemon is not the same thing as a working printer. A printer someone switched off keeps
// answering (that is the only way back on), so treating every answer as "managed" put the switched-off
// printer back to looking healthy on the very next ping, banner and all, seconds after it was switched
// off. The printer's own answer decides which of the two it is.
function statusFromDaemon(result: DaemonResult): Printer['status'] {
  return result.switchedOff ? 'deactivated' : 'managed'
}

function onDaemonResult(printer: Printer, result: DaemonResult, set: SetPrinters): void {
  const patch: Partial<Printer> = { status: statusFromDaemon(result), deactivated: result.switchedOff === true, connection: { reach: 'managed', sshOpen: true }, daemonVersion: result.daemonVersion, daemonUpdateAvailable: result.daemonUpdateAvailable }
  // The printer answered on this address; adopt it so the dropdown and every SSH op use the live IP,
  // not the lease it had at app start (otherwise an op SSHes to a stale IP after the printer moved).
  if (result.ip && result.ip !== printer.ip) patch.ip = result.ip
  if (result.networkInterfaces) patch.networkInterfaces = result.networkInterfaces
  // A healthy daemon makes any prior repair-vs-recover verdict obsolete, so a future OTA re-probes.
  if (printer.writeLayerIntact !== undefined) patch.writeLayerIntact = undefined
  if (result.installedIds !== undefined) patch.installedIds = result.installedIds
  if (result.installedVersions !== undefined) patch.installedVersions = result.installedVersions
  if (result.machineryVersions !== undefined) patch.machineryVersions = result.machineryVersions
  if (result.daemonDrift !== undefined) patch.daemonDrift = result.daemonDrift
  if (result.printerProblems !== undefined) patch.printerProblems = result.printerProblems
  if (result.rebootRequired !== undefined) patch.rebootRequired = result.rebootRequired
  if (result.jinniVersion !== undefined) patch.jinniVersion = result.jinniVersion
  if (result.jinniCapabilities !== undefined) patch.jinniCapabilities = result.jinniCapabilities
  if (result.jinniExtras !== undefined) patch.jinniExtras = result.jinniExtras
  if (result.printerUuid !== undefined) patch.printerUuid = result.printerUuid
  set(applyToId(printer.id, patch))
}

async function checkDaemonResult(printerId: string): Promise<DaemonResult | null> {
  try {
    return await window.b3d.printers.checkDaemon(printerId)
  } catch {
    return null
  }
}

const probeMisses = new Map<string, number>()

export function resetPrinterProbe(id: string): void { probeMisses.delete(id) }

// Printers whose one-shot write-layer probe is in flight, so overlapping pings never SSH twice.
const writeLayerChecksInFlight = new Set<string>()

// Decide repair-vs-recover once per recoverable episode: an enrolled printer whose daemon is down but
// SSH is open gets a single SSH verifyEnrolled probe (never on the ping ladder). Gated on the cached
// verdict being unset and not already running; custom-credential printers are skipped (no creds to
// auto-probe) and fall back to the op-time write-layer backstop.
function maybeCheckWriteLayer(printer: Printer, detail: PrinterConnection, set: SetPrinters): void {
  if (detail.reach !== 'recoverable') return
  if (printer.deactivated) return
  if (!printer.enrollmentLog || printer.customSshCredentials) return
  if (printer.writeLayerIntact !== undefined) return
  if (writeLayerChecksInFlight.has(printer.id)) return
  writeLayerChecksInFlight.add(printer.id)
  window.b3d.printers.checkWriteLayer(printer.id)
    .then((intact) => { if (intact !== null) set(applyToId(printer.id, { writeLayerIntact: intact })) })
    .catch(() => undefined)
    .finally(() => writeLayerChecksInFlight.delete(printer.id))
}

function targetStatus(report: DaemonResult): ProbeStatus {
  if (report.isManaged) return 'managed'

  return report.reach === 'offline' ? 'offline' : 'online'
}

function connectionDetail(report: DaemonResult): PrinterConnection {
  return { reach: report.reach ?? 'offline', sshOpen: report.sshOpen ?? false }
}

// Switching bespok3d off takes the boot hook with it, so once the printer restarts there is no daemon
// left to answer, and that silence is the state the user asked for, not a fault. Reading it as a fault
// is what offered Repair, Recover and a version update on a printer that was switched off.
function statusWhileSwitchedOff(reach: ConnectionReach): Printer['status'] {
  return reach === 'offline' ? 'offline' : 'deactivated'
}

// Walks the connection ladder (daemon -> Moonraker/nginx -> SSH -> nothing) via one IPC, then maps the
// rung reached to the status dot with downgrade hysteresis. A managed answer is authoritative and
// refreshes daemon metadata; anything lower stores the reach so the banners can offer the right action.
export async function pingAndUpdate(printer: Printer, set: SetPrinters): Promise<void> {
  const report = await checkDaemonResult(printer.id)
  const safe: DaemonResult = report ?? { isManaged: false, reach: 'offline', sshOpen: false, ip: printer.ip }
  const decision = statusAfterProbe(printer.status, targetStatus(safe), probeMisses.get(printer.id) ?? 0)
  probeMisses.set(printer.id, decision.misses)
  if (safe.isManaged) { onDaemonResult(printer, safe, set);

 return }
  const detail = decision.status === 'managed' ? { reach: 'managed' as const, sshOpen: true } : connectionDetail(safe)
  const patch: Partial<Printer> = { status: printer.deactivated ? statusWhileSwitchedOff(detail.reach) : decision.status, connection: detail }
  // Adopt the address the printer just answered on even when it is not managed (it may have moved to a
  // new lease), so a repair/enroll/recover op targets the live IP rather than the stale recorded one.
  if (safe.ip && safe.ip !== printer.ip) patch.ip = safe.ip
  if (safe.networkInterfaces) patch.networkInterfaces = safe.networkInterfaces
  set(applyToId(printer.id, patch))
  maybeCheckWriteLayer(printer, detail, set)
}

// Pull fresh endpoints into App state after a device-mutating batch. pingAndUpdate (checkDaemon) does
// not carry endpoints, so the printer fly-out (Mainsail/Camera/...) would otherwise stay stale until a
// manual reload; the single-install path already does this via its own capabilities refresh. A failed
// fetch is swallowed: main already saved the record with fresh endpoints, so a later ping reconciles.
export async function refreshEndpoints(printerId: string, set: SetPrinters): Promise<void> {
  try {
    const caps = await window.b3d.store.capabilities(printerId)
    set(applyToId(printerId, { endpoints: caps.endpoints, installedVersions: caps.installed }))
  } catch {
    return
  }
}
