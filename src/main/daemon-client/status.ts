// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { updatePrinter, loadPrinters, checkDaemon, checkSshOpen, checkMoonraker, gradeReach, resolveLiveAddress, knownAddresses } from '../printers'
import type { ConnectionReach, PrinterRecord, DriftReport } from '../printers'
import { macForIp } from '../mdns/arp'
import { fetchCapabilities, fetchDaemonStatus, fetchSelfCheck } from './client'
import { expectedDaemonVersion } from './expected-version'
import { runningMachineryVersions } from '../compat/system-packages'
import { listAdapters } from '../adapter-loader'
import { isReleaseNewer, isDaemonVersionAtLeast, reportedVersionOrNull } from '@bespok3d/contract'
import type { CapabilitiesResult, DaemonMetadata, PrinterProblem } from '@bespok3d/contract'
import type { SelfCheckResult } from './client'

// The daemon and the adapter jinni arrive with enrollment and live outside the plugin tree, so the
// printer never lists them among the plugins it reports. Their running versions are worked out here,
// which is why they hang off the app's own answer rather than off the daemon's contract shape.
export interface DaemonAnswer extends DaemonMetadata {
  machineryVersions?: Record<string, string>
}

export interface CheckDaemonResult extends DaemonAnswer {
  isManaged: boolean
  reach: ConnectionReach
  sshOpen: boolean
  // The address the printer actually answered on this probe, so the renderer can adopt it when a DHCP
  // lease moved (its in-memory ip is otherwise only refreshed on app restart, leaving ops on a stale IP).
  ip: string
  // Every address the printer is known to answer on now (recorded IP + fresh sightings). Drives the
  // dropdown's "Also reachable at" line so a flip-flopping lease is shown, not a confusing mystery.
  networkInterfaces: Array<{ ip: string }>
}

const VERIFY_REQUEST_TIMEOUT_MS = 5000
const VERIFY_RETRY_DELAY_MS = 2000
const VERIFY_ATTEMPTS = 5
// Per-request bound for the status ping loop, so a wedged daemon never hangs the loop for a printer.
export const DAEMON_QUERY_TIMEOUT_MS = 8000

export function dedupeEndpoints(endpoints: Array<{ label: string; url: string }>) {
  const byUrl = new Map(endpoints.map((endpoint) => [endpoint.url, endpoint]))

  return [...byUrl.values()]
}

// The printer this answer came from, as much of it as reading the answer needs: the address the
// endpoints are rewritten to, and the daemon version, which `/capabilities` does not carry.
export interface CapabilitiesHost {
  ip: string
  daemonVersion?: string
}

export function parseCaps(caps: CapabilitiesResult, printer: CapabilitiesHost) {
  const rawInstalled = caps.installed as unknown
  const installedVersions: Record<string, string> = Array.isArray(rawInstalled)
    ? Object.fromEntries((rawInstalled as string[]).map((id) => [id, '']))
    : (rawInstalled as Record<string, string>)
  const reachableEndpoints = (caps.endpoints ?? []).map((endpoint) => ({ ...endpoint, url: endpoint.url.replace('{host}', printer.ip) }))
  const machinery = { adapter: caps.adapter, daemonVersion: printer.daemonVersion, jinniVersion: caps.jinni_version }

  return {
    installedIds: Object.keys(installedVersions),
    installedVersions,
    machineryVersions: runningMachineryVersions(machinery, listAdapters()),
    endpoints: dedupeEndpoints(reachableEndpoints),
    firmwareVersion: caps.firmware_version ?? 'unknown',
    jinniVersion: caps.jinni_version ?? 'unknown',
    jinniCapabilities: caps.capability_flags ?? [],
    jinniExtras: caps.interface_extras ?? [],
  }
}

export function summarizeDrift(selfCheck: SelfCheckResult): DriftReport[] {
  if (selfCheck.ok) return []

  return (selfCheck.drift ?? []).map((pluginReport) => ({
    pluginId: pluginReport.plugin_id,
    symlinkIssueCount: pluginReport.symlink_issues.length,
  }))
}

export function summarizeProblems(selfCheck: SelfCheckResult): PrinterProblem[] {
  return (selfCheck.problems ?? []).map((problem) => ({
    kind: problem.kind,
    detail: problem.detail,
    pluginId: problem.plugin_id,
  }))
}

// The printer decides whether bespok3d is switched off on it, not the app's own notes. Those two used
// to be able to disagree forever: the marker lives on the device, the status lived in this app's
// records, and a printer switched off from another machine, from a fresh install, or found already off
// kept showing as fully managed with no way back on offered. Returns only what has to change, so a
// printer whose records already agree with it is not rewritten on every ping.
export function switchedOffCorrection(record: PrinterRecord, selfCheck: SelfCheckResult): Partial<PrinterRecord> {
  const switchedOff = selfCheck.switched_off === true
  if (switchedOff && record.status !== 'deactivated') {
    return { deactivated: true, status: 'deactivated', deactivatedAt: record.deactivatedAt ?? new Date().toISOString() }
  }
  if (!switchedOff && record.status === 'deactivated') {
    return { deactivated: false, status: 'managed', deactivatedAt: undefined }
  }

  return {}
}

export function getManagedRecord(printerId: string): PrinterRecord {
  const record = loadPrinters().find((rec) => rec.id === printerId)
  if (!record?.daemonToken || !record.daemonCert) throw new Error('printer not managed')

  return record
}

export function recordOrThrow(printerId: string): PrinterRecord {
  const record = loadPrinters().find((rec) => rec.id === printerId)
  if (!record) throw new Error('printer not found')

  return record
}

// The printer's daemon is behind when the version this app bundles is STRICTLY NEWER than the one it
// reports. A device on the same or a newer daemon (a dev build ahead of the app) is never nagged: the
// app can only deploy the daemon it carries, so offering an "update" to an older version would be a
// downgrade. Drives the "update available" signal; recomputed on every checkDaemon ping. An unknown
// device version (a daemon too old to report one) still offers the update, to land it on a known daemon.
export function daemonNeedsUpdate(deviceVersion: string | undefined): boolean {
  if (!deviceVersion) return true

  return isReleaseNewer(deviceVersion, expectedDaemonVersion())
}

// Whether the printer came back on a daemon at least as new as the one this build ships. The
// compatibility contract is floors and no ceilings, so a printer already on a NEWER daemon than the
// bundle is a good pair and must not be called a failed deploy. A version the printer will not state
// is not a pass: after a deploy the app can and must know the number.
function daemonReachesBundled(actualVersion: string | undefined): boolean {
  const reported = reportedVersionOrNull(actualVersion)

  return reported !== null && isDaemonVersionAtLeast(reported, expectedDaemonVersion())
}

// After (re)deploying the bundled daemon, the printer MUST come back on that version or newer.
// Without this a stale or failed deploy reports success and the update signal clears even though the
// printer never got the new daemon. Throwing here keeps the op honest (no false "up to date").
export function assertDaemonVersion(actualVersion: string | undefined): void {
  if (daemonReachesBundled(actualVersion)) return
  throw new Error(
    `Daemon reports ${actualVersion || 'unknown'} after the update, expected ${expectedDaemonVersion()} or newer. ` +
    `The new daemon did not take: it may not have restarted, or the app bundled an out-of-date ` +
    `daemon. The printer was left on its previous daemon.`,
  )
}

// Confirm the printer came back on the bundled version, BOUNDED so it can never hang: each /status
// fetch times out, and after a fixed number of attempts (the daemon may be briefly unresponsive just
// after its restart) it fails cleanly with a clear message rather than waiting forever.
export async function verifyDaemonVersion(record: PrinterRecord, attemptsLeft: number = VERIFY_ATTEMPTS): Promise<void> {
  const version = await fetchDaemonStatus(record, VERIFY_REQUEST_TIMEOUT_MS)
    .then((status) => status.version)
    .catch(() => undefined)
  if (daemonReachesBundled(version)) return
  if (attemptsLeft <= 1) return assertDaemonVersion(version)
  await new Promise<void>((resolve) => setTimeout(resolve, VERIFY_RETRY_DELAY_MS))

  return verifyDaemonVersion(record, attemptsLeft - 1)
}

// "managed" requires the daemon to actually ANSWER, not just hold port 4269 open: a wedged daemon
// that accepts the TCP connect but never serves HTTP is not healthy. Returns null (not managed) when
// the daemon is absent or unresponsive, so the caller falls through to the web/SSH ladder rungs.
async function daemonMetadata(record: PrinterRecord): Promise<DaemonAnswer | null> {
  if (!record.daemonToken || !record.daemonCert) return null
  if (!(await checkDaemon(record.ip))) return null
  try {
    // Bound every call: this runs on the status ping loop, so an unbounded request against a daemon
    // that holds the port open but never answers HTTP would hang the loop for that printer forever.
    const [status, caps, selfCheck] = await Promise.all([
      fetchDaemonStatus(record, DAEMON_QUERY_TIMEOUT_MS),
      fetchCapabilities(record, DAEMON_QUERY_TIMEOUT_MS),
      // A check that did not answer says nothing about the printer's health. Claiming "all fine" here
      // is what let a broken printer look sound, so an unanswered check leaves the last known health
      // on the record untouched instead of overwriting it with a clean bill.
      fetchSelfCheck(record, DAEMON_QUERY_TIMEOUT_MS).catch(() => null),
    ])
    const daemonUpdateAvailable = daemonNeedsUpdate(status.version)
    // The version this probe just read, not the one on the record: after a daemon update the record
    // still holds the old number until this same write lands, and the store would show it for a whole
    // ping cycle as an update the printer has already taken.
    const parsed = parseCaps(caps, { ip: record.ip, daemonVersion: status.version })
    // A daemon too old to know about power cycles omits the key entirely, and that reads as "nothing
    // to reboot for", never as "unknown": an old daemon must not make the app nag for a power cycle.
    const health = selfCheck ? {
      daemonDrift: summarizeDrift(selfCheck),
      printerProblems: summarizeProblems(selfCheck),
      rebootRequired: selfCheck.reboot_required ?? [],
    } : {}
    const switchState = selfCheck ? switchedOffCorrection(record, selfCheck) : {}
    // Learn the printer's MAC once from the ARP table: it is the identity that follows the printer
    // across a DHCP lease move when its hostname (`lava`) is shared with other U1s. Captured here on a
    // confirmed managed probe so a later flap can re-resolve by MAC, not just an ambiguous hostname.
    const learnedMac = record.mac ? undefined : macForIp(record.ip)
    // The daemon-minted stable identity. Old daemons omit the key, a rootless daemon reports null;
    // both mean "no uuid to learn", and neither may clear a uuid already on the record.
    const printerUuid = status.printer_uuid ?? undefined
    updatePrinter(record.id, { daemonVersion: status.version, daemonUpdateAvailable, ...health, ...switchState, ...parsed, ...(learnedMac ? { mac: learnedMac } : {}), ...(printerUuid ? { printerUuid } : {}) })

    return {
      daemonVersion: status.version,
      daemonUpdateAvailable,
      installedIds: parsed.installedIds,
      installedVersions: parsed.installedVersions,
      // Written to the record alone, this reaches the store only on the next app start, which is what
      // left the daemon card offering to install what the printer was already running all session.
      machineryVersions: parsed.machineryVersions,
      ...health,
      switchedOff: selfCheck?.switched_off === true,
      jinniVersion: parsed.jinniVersion,
      jinniCapabilities: parsed.jinniCapabilities,
      jinniExtras: parsed.jinniExtras,
      ...(printerUuid ? { printerUuid } : {}),
    }
  } catch {
    return null
  }
}

// The connection ladder for one address: confirm the daemon (managed), else grade the remaining
// surfaces (Moonraker for "alive", SSH for "we can still fix or enroll it") so the app always knows
// what is going on and which action to offer, instead of a bare reachable/unreachable.
async function probeAddress(record: PrinterRecord): Promise<Omit<CheckDaemonResult, 'ip' | 'networkInterfaces'>> {
  const metadata = await daemonMetadata(record)
  if (metadata) return { ...metadata, isManaged: true, reach: 'managed', sshOpen: true }
  const [moonrakerOpen, sshOpen] = await Promise.all([checkMoonraker(record.ip), checkSshOpen(record.ip)])

  return { isManaged: false, reach: gradeReach(moonrakerOpen, sshOpen), sshOpen }
}

// Probe the printer, following it if its lease moved: try the recorded address first (the common,
// stable case), and only if it is not managed there resolve the address the printer answers on right
// now (probing the recorded IP plus every fresh discovery sighting of the same device) and re-grade
// there. The live address is persisted AND returned so the renderer adopts it, so a DHCP flap never
// grades a healthy printer dead/rootless and never leaves a later op pointed at a stale IP.
export async function checkDaemonRecord(printerId: string): Promise<CheckDaemonResult> {
  const record = loadPrinters().find((rec) => rec.id === printerId)
  if (!record) return { isManaged: false, reach: 'offline', sshOpen: false, ip: '', networkInterfaces: [] }
  const atRecorded = await probeAddress(record)
  if (atRecorded.isManaged) return { ...atRecorded, ip: record.ip, networkInterfaces: knownAddresses(printerId) }
  const liveIp = await resolveLiveAddress(printerId)
  const reprobed = liveIp === record.ip ? atRecorded : await probeAddress({ ...record, ip: liveIp })

  return { ...reprobed, ip: liveIp, networkInterfaces: knownAddresses(printerId) }
}
