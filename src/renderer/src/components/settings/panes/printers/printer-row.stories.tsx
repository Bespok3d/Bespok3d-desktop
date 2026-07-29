// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { PrintersPane } from './index'
import { PrinterActionsContext } from '../../printer-actions'
import type { PrinterActions } from '../../printer-actions'
import { Enrollment } from '../../../enrollment'
import type { EnrollMode } from '../../../enrollment'
import { makePrinter, makeAdapterInfo } from '../../../../test/fixtures'
import type { Printer } from '../../../../data/types'

export default { title: 'Settings / Printer row' }

// makeAdapterInfo ships jinni 0.1.6, so a "current" printer must report 0.1.6 too; otherwise the Deploy
// button reads as update-pending in every story and the update states stop standing out.
const ADAPTER_JINNI = '0.1.6'

function noop() {}

const NOOP_ACTIONS: PrinterActions = {
  onAddPrinter: noop, onRemovePrinter: noop, onUpdatePrinterIcon: noop, onEnrollPrinter: noop,
  onRepairPrinter: noop, onRecoverPrinter: noop, onReinstallPlugins: noop, onViewEnrollmentLog: noop,
  onUpdateDaemon: noop, onUpdateJinni: noop, onDeactivatePrinter: noop, onReactivatePrinter: noop,
  onUninstallPrinter: noop, onSetCustomSshCredentials: noop,
}

const STEPS = [
  { id: 'preflight', label: 'Preflight checks', detail: 'Stock firmware, not mid-print' },
  { id: 'stable-network', label: 'Stabilize network', detail: 'Cleared stale DHCP lease' },
  { id: 'deploy-daemon', label: 'Deploy daemon', detail: 'Uploaded daemon + jinni' },
  { id: 'start-daemon', label: 'Start daemon', detail: 'Daemon responding on :4269' },
]
const ENROLLED = { enrollmentLog: { enrolledAt: '2026-06-16T22:03:00Z', adapterId: 'snapmaker-u1', steps: STEPS } }

// Renders the real PrintersPane so the catalog exercises the actual remove/deactivate dialogs and the
// Deploy/Force flyouts. Every state's call-to-action opens the REAL enrollment modal in its matching
// mode (Repair -> repair flow, "Enrolled" -> history, Update -> update-daemon, ...), so each
// click-through shows the real component the app opens, not a stand-in. Deactivate/uninstall/remove keep
// flowing through the pane's own confirm dialogs.
function Pane({ printer }: { printer: Printer }) {
  const [openMode, setOpenMode] = useState<EnrollMode | null>(null)
  function open(mode: EnrollMode) {
    return () => setOpenMode(mode)
  }
  const actions: PrinterActions = {
    ...NOOP_ACTIONS,
    onViewEnrollmentLog: open('history'),
    onEnrollPrinter: open('enroll'),
    onRepairPrinter: open('repair'),
    onRecoverPrinter: open('recovery'),
    onReactivatePrinter: open('reactivate'),
    onUpdateDaemon: open('update-daemon'),
    onUpdateJinni: open('update-jinni'),
  }

  return (
    <PrinterActionsContext.Provider value={actions}>
      <PrintersPane printers={[printer]} adapters={[makeAdapterInfo()]} />
      {openMode && <Enrollment printer={printer} mode={openMode} onEnrolled={() => setOpenMode(null)} onClose={() => setOpenMode(null)} />}
    </PrinterActionsContext.Provider>
  )
}

export function Managed() {
  return <Pane printer={makePrinter({ status: 'managed', jinniVersion: ADAPTER_JINNI, daemonVersion: '0.12.10-dev', daemonUpdatedAt: '2026-06-17T15:56:00Z', ...ENROLLED })} />
}

export function DaemonUpdateAvailable() {
  return <Pane printer={makePrinter({ status: 'managed', jinniVersion: ADAPTER_JINNI, daemonVersion: '0.12.9-dev', daemonUpdateAvailable: true, ...ENROLLED })} />
}

export function JinniUpdateAvailable() {
  return <Pane printer={makePrinter({ status: 'managed', jinniVersion: '0.1.5', daemonVersion: '0.12.10-dev', ...ENROLLED })} />
}

export function OnlineUnenrolled() {
  return <Pane printer={makePrinter({ status: 'online', daemonVersion: undefined, jinniVersion: undefined })} />
}

export function OnlineEnrolledNeedsRepair() {
  return <Pane printer={makePrinter({ status: 'online', jinniVersion: ADAPTER_JINNI, connection: { reach: 'recoverable', sshOpen: true }, ...ENROLLED })} />
}

export function Deactivated() {
  return <Pane printer={makePrinter({ status: 'deactivated', jinniVersion: ADAPTER_JINNI, deactivatedAt: '2026-06-18T09:00:00Z', ...ENROLLED })} />
}

export function Offline() {
  return <Pane printer={makePrinter({ status: 'offline', jinniVersion: ADAPTER_JINNI, ...ENROLLED })} />
}

export function Checking() {
  return <Pane printer={makePrinter({ status: 'checking', jinniVersion: ADAPTER_JINNI, ...ENROLLED })} />
}

export function CustomSshOn() {
  return <Pane printer={makePrinter({ status: 'managed', jinniVersion: ADAPTER_JINNI, customSshCredentials: true, ...ENROLLED })} />
}

export function WithJinniExtras() {
  return <Pane printer={makePrinter({ status: 'managed', jinniVersion: ADAPTER_JINNI, jinniExtras: ['lmd_control', 'panel_wake'], ...ENROLLED })} />
}
