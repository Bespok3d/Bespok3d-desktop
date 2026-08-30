// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReleaseChannel } from '../settings'
import type { PackageTrust } from '../registry/model'
import type { InstallLog, Endpoint, DriftReport, PrinterProblem, ConfigTruthRecords } from '@bespok3d/contract'

export interface EnrollmentLogStep {
  id: string
  label: string
  detail: string
}

export interface EnrollmentLog {
  enrolledAt: string
  adapterId: string
  steps: EnrollmentLogStep[]
}

export type { DriftReport, PrinterProblem }

// The truth-ladder records (appliedPluginVars/-At, printerUuid) come from ConfigTruthRecords in
// @bespok3d/contract, the single definition shared with the renderer Printer state.
export interface PrinterRecord extends ConfigTruthRecords {
  id: string
  nick: string
  model: string
  adapter: string
  host: string
  ip: string
  // The printer's hardware MAC, captured from the ARP table on a successful probe. The stable identity
  // for following a printer across a DHCP lease move when its mDNS hostname is shared (every U1 answers
  // to `lava`), so a host match alone could redirect a probe to the wrong printer.
  mac?: string
  status: 'checking' | 'offline' | 'online' | 'managed' | 'deactivated'
  deactivated?: boolean
  customSshCredentials?: boolean
  installedIds: string[]
  // The installed plugins the printer has switched OFF: on disk, listed in `installedIds`, providing
  // nothing. Read from `/capabilities` on every probe so the app answers "is this dependency there?"
  // the same way the printer does, instead of counting a switched-off plugin as a working one.
  deactivatedIds?: string[]
  installedVersions?: Record<string, string>
  // What the printer's own machinery is running, keyed by package name: the daemon, and the jinni of
  // the adapter this printer uses. Kept apart from `installedVersions` because the machinery is not in
  // the plugin tree the daemon reports and must never be treated as a plugin that can be removed.
  machineryVersions?: Record<string, string>
  // Provenance: the source registry url each installed plugin was installed from, keyed by plugin
  // id. Set app-side at install time (the daemon only knows id+version, not origin), so the detail
  // view can show "installed from X" and offer switching to another source's copy.
  installedSources?: Record<string, string>
  // The release channel each installed plugin was installed from, keyed by plugin id. Set app-side at
  // install time (the daemon only knows id+version) so the card can badge the installed channel and
  // update detection compares against the same channel the user is on.
  installedChannels?: Record<string, ReleaseChannel>
  // What the installed package's OWN detached manifest signature proved at install time, keyed by
  // plugin id. Separate from the source's list-level trust: that one describes where the plugin was
  // listed, this one describes the bytes that actually landed on the printer. 'unknown' means the
  // package carried no signature, never that a signature failed (a failed one refuses the install).
  installedPackageTrust?: Record<string, PackageTrust>
  // The most recent install log per plugin id, persisted so the detail view's Install-log tab
  // survives an app restart (the renderer's in-memory history is lost on reload). Cleared on uninstall.
  installLogs?: Record<string, InstallLog>
  // The most recent FAILED attempt per plugin id: what the printer got through before it gave up, or
  // the reason the app would not send the package at all. Kept whether the user installed that plugin
  // on its own or inside a batch, and dropped as soon as the plugin installs.
  failedInstallLogs?: Record<string, InstallLog>
  endpoints?: Endpoint[]
  iconColor?: string
  iconImage?: string
  iconSize?: number
  enrollmentLog?: EnrollmentLog
  daemonToken?: string
  daemonCert?: string
  accessIdentity?: string
  daemonVersion?: string
  daemonUpdateAvailable?: boolean
  daemonUpdatedAt?: string
  deactivatedAt?: string
  daemonDrift?: DriftReport[]
  printerProblems?: PrinterProblem[]
  // Machine tokens the printer says require a power cycle to clear (e.g. "display-pipe-wedged").
  // Empty or absent = no reboot needed; see DaemonMetadata in @bespok3d/contract for the full rule.
  rebootRequired?: string[]
  firmwareVersion?: string
  jinniVersion?: string
  jinniCapabilities?: string[]
  jinniExtras?: string[]
  // Strings captured from each installed plugin's service log (URLs/regex matches), keyed by plugin
  // id, newest last. Persisted per printer so a one-time link the user saw once is still here later.
  pluginCaptures?: Record<string, string[]>
}

// The daemon credentials that authorize this app to the printer. They are written and read only by
// the main process (the daemon client signs every request with them) and must never cross the IPC
// boundary into the renderer, so PublicPrinterRecord omits them by type.
type PrinterSecretKey = 'daemonToken' | 'daemonCert' | 'accessIdentity'

// The renderer-safe projection of a printer: the full record minus the daemon credentials. This is
// the single source the renderer's PrinterRecord type re-exports, so the redaction is enforced at
// compile time and cannot drift from a hand-maintained subset.
export type PublicPrinterRecord = Omit<PrinterRecord, PrinterSecretKey>

export function toPublicRecord(record: PrinterRecord): PublicPrinterRecord {
  const { daemonToken: _daemonToken, daemonCert: _daemonCert, accessIdentity: _accessIdentity, ...publicRecord } = record

  return publicRecord
}

// The rung the connection ladder reached for a printer whose daemon did not answer: SSH up so we can
// repair/enroll (recoverable), alive but root off (alive-no-ssh), or unreachable (offline); managed
// is the healthy daemon case.
export type ConnectionReach = 'managed' | 'recoverable' | 'alive-no-ssh' | 'offline'
