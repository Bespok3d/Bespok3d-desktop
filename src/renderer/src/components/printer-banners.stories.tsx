// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PrinterBanners } from './printer-banners'
import { makePrinter } from '../test/fixtures'
import type { Printer } from '../data/types'

export default { title: 'App / Printer banners' }

const ADAPTER_JINNI = '0.1.6'
const ENROLLED = { enrollmentLog: { enrolledAt: '2026-06-16T22:03:00Z', adapterId: 'snapmaker-u1', steps: [] } }

function noop() {}

const HANDLERS = { onRepair: noop, onRecover: noop, onReactivate: noop, onRecoverDrift: noop, onUpdateJinni: noop, onReboot: noop }

function Banner({ printer, bundledJinniVersion }: { printer: Printer; bundledJinniVersion?: string }) {
  return <PrinterBanners selectedPrinter={printer} bundledJinniVersion={bundledJinniVersion} {...HANDLERS} />
}

// Daemon down but the printer answers over SSH: the lightweight redeploy that keeps the pinned cert.
export function NeedsRepair() {
  return <Banner printer={makePrinter({ status: 'online', connection: { reach: 'recoverable', sshOpen: true }, ...ENROLLED })} />
}

// A firmware update reset the overlay (write layer gone): a full recover, not a repair.
export function NeedsRecovery() {
  return <Banner printer={makePrinter({ status: 'online', connection: { reach: 'recoverable', sshOpen: true }, writeLayerIntact: false, ...ENROLLED })} />
}

// Alive but root access (SSH) is off: informational, the fix is on the device.
export function RootAccessOff() {
  return <Banner printer={makePrinter({ status: 'online', connection: { reach: 'alive-no-ssh', sshOpen: false }, ...ENROLLED })} />
}

export function Deactivated() {
  return <Banner printer={makePrinter({ status: 'deactivated', ...ENROLLED })} />
}

// The printer stopped including bespok3d in its own config, and has no plugins left to drift.
export function PrinterProblem() {
  return <Banner printer={makePrinter({ status: 'managed', installedIds: [], printerProblems: [{ kind: 'includes_missing', detail: 'printer.cfg', pluginId: null }], ...ENROLLED })} />
}

// Plugin state on a managed printer drifted from what is installed.
export function Drift() {
  return <Banner printer={makePrinter({ status: 'managed', daemonDrift: [{ pluginId: 'spoolman', symlinkIssueCount: 2 }], ...ENROLLED })} />
}

// The printer itself says it needs a power cycle to clear something (ranks above drift).
export function RebootRequired() {
  return <Banner printer={makePrinter({ status: 'managed', rebootRequired: ['some-future-token'], ...ENROLLED })} />
}

// The deployed adapter (jinni) lags the one this app build ships.
export function JinniUpdate() {
  return <Banner printer={makePrinter({ status: 'managed', jinniVersion: '0.1.0', ...ENROLLED })} bundledJinniVersion={ADAPTER_JINNI} />
}
