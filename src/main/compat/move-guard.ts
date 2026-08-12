// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The questions asked before the app moves a printer's daemon, and the one asked after it landed.
//
// Every one of them is answered from what the printer says now, never from the printer record: the
// moments this matters most are exactly the moments the record is stale.
//
// The daemon and the device support package travel in ONE deploy step, so a move puts both halves on
// the printer or neither. What can still go wrong is the step failing part way, and that is why the
// record is only written after the landed pair has been read back and accepted: a half-done move
// leaves the printer on the pair it started with, on the daemon that is still running, and offers the
// owner the same button again rather than telling him a move happened that did not.
import { isDaemonVersionAtLeast } from '@bespok3d/contract'

import { pairRefusal } from './floors'
import { askPrinterCompat, reportedDaemonVersion } from './reported'
import { expectedDaemonVersion } from '../daemon-client/expected-version'
import { reportedBlockedActions } from '../daemon-client/feeds/print-state'
import { loadPrinters } from '../printers'
import type { PrinterRecord } from '../printers'

// An operation the app declined to start, or declined to call finished. Distinct from a failure: the
// printer is untouched, or is exactly as it was before, and the message says what to do about it.
export class DaemonMoveRefused extends Error {}

// Deploying is always a move FORWARD. A printer already running a daemon newer than the one this app
// build ships would be put backwards by a deploy, silently losing whatever that newer daemon added. A
// printer that will not say its version is not refused: the deploy's own verification still catches a
// move that did not take.
//
// Forced is the owner saying he knows and wants it anyway, which is the whole point of the Force menu:
// the app ships the daemon it ships, and putting a printer back onto it is sometimes exactly the repair
// he is after. Nothing else the guards refuse is waived by it.
export async function assertNotADaemonDowngrade(record: PrinterRecord, forced = false): Promise<void> {
  if (forced) return
  const running = await reportedDaemonVersion(record)
  if (!running || isDaemonVersionAtLeast(expectedDaemonVersion(), running)) return

  throw new DaemonMoveRefused(
    `This printer already runs the Bespok3d daemon ${running} and this app ships ${expectedDaemonVersion()}, ` +
    `so deploying would put it back onto the older daemon. Update Bespok3d itself first.`,
  )
}

// The same question for a path that is handed an id rather than a record, which is how enrollment
// arrives: recovery after a firmware update re-enrolls a printer the app already knows. An id the app
// has no record for is a first enrollment and has nothing to be put backwards.
export async function assertKnownPrinterNotDowngraded(printerId: string, forced = false): Promise<void> {
  const record = loadPrinters().find((known) => known.id === printerId)
  if (!record) return

  await assertNotADaemonDowngrade(record, forced)
}

// Moving either half restarts the daemon and the printer services it drives, so it never happens while
// a print is running. The answer comes from the print state the app is already told about; a printer
// the app was never told about is not refused.
export function assertPrinterNotPrinting(printerId: string): void {
  const blocked = reportedBlockedActions(printerId)
  if (!blocked || blocked.length === 0) return

  throw new DaemonMoveRefused(
    'This printer is printing. Updating it restarts the daemon, so let the print finish and try again.',
  )
}

// Read back what actually landed and refuse to call the move done on a pair that does not fit. The
// versions come from the printer's own answers in one breath, so a move that only got half way is
// caught here rather than being recorded as a success the owner cannot see through.
export async function assertPairLandedTogether(record: PrinterRecord): Promise<void> {
  const facts = await askPrinterCompat(record)
  const refusal = pairRefusal(facts.pair, facts.daemonDeclaredFloors)
  if (!refusal) return

  throw new DaemonMoveRefused(refusal)
}
