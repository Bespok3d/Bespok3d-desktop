// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What the printer says it is running, asked now.
//
// Never the printer record. A stored version is what the app last saw, and the moments when the pair
// check matters most are exactly the moments the record is stale: after a firmware update wiped the
// daemon, after a recovery put a different one back, after someone deployed by hand. A refusal built
// on a remembered number can refuse a pair that is fine and pass a pair that is not.
//
// A read that fails answers null rather than throwing. Not knowable is not a refusal: a daemon
// mid-restart must not become "this package cannot be installed".
import type { PrinterRecord } from '../printers'
import { reportedVersionOrNull } from '@bespok3d/contract'
import { fetchCapabilities, fetchDaemonStatus } from '../daemon-client/client'
import type { DeclaredFloors, ReportedPair } from './floors'

// Short on purpose: this read gates an action the owner is waiting on, and an unreachable printer must
// fall through to "not knowable" quickly rather than hold the install open.
const COMPAT_READ_TIMEOUT_MS = 5000

export async function reportedDaemonVersion(record: PrinterRecord): Promise<string | null> {
  const status = await fetchDaemonStatus(record, COMPAT_READ_TIMEOUT_MS).catch(() => undefined)

  return reportedVersionOrNull(status?.version)
}

export interface PrinterCompatFacts {
  pair: ReportedPair
  // The floor the daemon itself declares. The jinni's own floor is not here: it comes from the package
  // being installed or from the resolved catalog entry, not from the printer.
  daemonDeclaredFloors: DeclaredFloors
}

// Both halves of the pair and the floor the daemon declares, read in one pass so the two numbers being
// compared are the two the printer reported in the same breath.
export async function askPrinterCompat(record: PrinterRecord): Promise<PrinterCompatFacts> {
  const [status, caps] = await Promise.all([
    fetchDaemonStatus(record, COMPAT_READ_TIMEOUT_MS).catch(() => undefined),
    fetchCapabilities(record, COMPAT_READ_TIMEOUT_MS).catch(() => undefined),
  ])

  return {
    pair: {
      daemonVersion: reportedVersionOrNull(status?.version),
      jinniVersion: reportedVersionOrNull(caps?.jinni_version),
    },
    daemonDeclaredFloors: {
      minDaemonVersion: null,
      minJinniVersion: reportedVersionOrNull(caps?.min_jinni_version),
    },
  }
}
