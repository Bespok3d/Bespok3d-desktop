// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DriftReport, PrinterProblem, ConfigTruthRecords } from '@bespok3d/contract'
import type { DaemonAccessState } from '../../../main/daemon-client/status'
import type { PublicPrinterRecord } from '../../../main/printers/record'

type PrinterPackageHistory = Pick<PublicPrinterRecord,
  'installedVersions' | 'machineryVersions' | 'installedSources' | 'installedChannels' | 'installedPackageTrust' | 'installLogs' | 'failedInstallLogs'
>

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

// The truth-ladder records (appliedPluginVars/-At, printerUuid) come from ConfigTruthRecords in
// @bespok3d/contract, the single definition shared with main's persisted PrinterRecord.
export interface Printer extends ConfigTruthRecords, PrinterPackageHistory {
  id: string
  nick: string
  model: string
  adapter: string
  host: string
  ip: string
  // The printer's hardware MAC, learned from the ARP table on a managed probe. The stable identity for
  // following the printer across a DHCP lease move when its mDNS hostname is shared (every U1 is `lava`).
  mac?: string
  // Every network the printer answers on, when it answers on more than one (Wi-Fi + Ethernet, or a
  // VPN). The dropdown reveals an extra line listing these only when length > 1; `ip` stays the
  // primary address. Optional: most printers answer on a single interface and carry no list.
  networkInterfaces?: Array<{ label?: string; ip: string }>
  status: 'checking' | 'offline' | 'online' | 'managed' | 'deactivated'
  deactivated?: boolean
  installedIds: string[]
  customSshCredentials?: boolean
  // Installed plugins a safety fixer (or the user) turned off; shown as Disabled, not Installed.
  deactivatedIds?: string[]
  endpoints?: Array<{ label: string; url: string }>
  iconColor?: string
  iconImage?: string
  iconSize?: number
  enrollmentLog?: EnrollmentLog
  accessIdentity?: string
  daemonVersion?: string
  daemonUpdateAvailable?: boolean
  daemonUpdatedAt?: string
  deactivatedAt?: string
  expectedRestartUntil?: number
  daemonDrift?: DriftReport[]
  printerProblems?: PrinterProblem[]
  // Machine tokens the printer says require a power cycle to clear (e.g. "display-pipe-wedged").
  // Empty or absent = no reboot needed; see DaemonMetadata in @bespok3d/contract for the full rule.
  rebootRequired?: string[]
  firmwareVersion?: string
  jinniVersion?: string
  jinniCapabilities?: string[]
  jinniExtras?: string[]
  // Latest connection-ladder reading: which surface answered last probe. Drives the dot tooltip and
  // the repair / enable-root banners. Recomputed on every status ping.
  connection?: PrinterConnection
  // Repair-vs-recover verdict from a one-shot SSH verifyEnrolled probe, taken once per recoverable
  // episode. undefined = not yet checked, true = write layer intact (daemon glitch -> Repair),
  // false = overlay reset by a firmware OTA (-> full Recover). Cleared when the daemon answers.
  writeLayerIntact?: boolean
}

// The rung the connection ladder reached: daemon healthy (managed), daemon down but SSH up so we can
// repair/enroll (recoverable), alive but root access off (alive-no-ssh), or unreachable (offline).
export type ConnectionReach = 'managed' | 'recoverable' | 'alive-no-ssh' | 'offline'

export interface PrinterConnection {
  reach: ConnectionReach
  sshOpen: boolean
  accessState?: DaemonAccessState
}
