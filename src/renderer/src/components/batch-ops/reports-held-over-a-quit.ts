// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'
import type { Printer } from '../../data/types'
import { HELD_REPORTS_KEY, forgetFor, keptByPrinter, type HeldReport } from './kept-over-a-quit'

type HeldByPrinter = ReadonlyMap<string, HeldReport>

// Only a printer whose daemon answers is back from the reboot the report was held over. A printer
// switched off answers too: that is how it is switched back on.
const DAEMON_ANSWERS: Printer['status'][] = ['managed', 'deactivated']

// A report a later reactivate of the printer held in its place belongs to that window, not to this
// launch, and one a later recover or a newer report replaced is not owed any more.
function stillHeldFromBefore(heldBefore: HeldByPrinter): [string, HeldReport][] {
  const keptNow = keptByPrinter(HELD_REPORTS_KEY)

  return [...heldBefore].filter(([printerId, held]) => keptNow.get(printerId)?.heldAt === held.heldAt)
}

function firstReadyToShow(heldBefore: HeldByPrinter, printers: Printer[]): [string, HeldReport] | undefined {
  const answeringPrinterIds = new Set(printers.filter((printer) => DAEMON_ANSWERS.includes(printer.status)).map((printer) => printer.id))

  return stillHeldFromBefore(heldBefore).find(([printerId]) => answeringPrinterIds.has(printerId))
}

function withoutThePrinter(heldBefore: HeldByPrinter, printerId: string): HeldByPrinter {
  return new Map([...heldBefore].filter(([heldPrinterId]) => heldPrinterId !== printerId))
}

// The plugins a reactivate left off are reported once its window on the printer's reboot is gone. A
// user who quit the app while that window was up never saw it, so this launch shows it once the
// printer answers again, and forgets it once shown. Only the reports kept before this launch are
// looked at: one a window of this launch holds is that window's to show when it goes. One report at a
// time, and none over a recover's screens or a window on a printer, which may be following a reboot
// itself: the next waits until the screen in front is closed.
export function useReportsHeldOverAQuit(printers: Printer[], screenInFront: boolean, showPluginsLeftOff: (reapplied: BatchResult) => void): void {
  const [heldBeforeThisLaunch, setHeldBeforeThisLaunch] = useState<HeldByPrinter>(() => keptByPrinter(HELD_REPORTS_KEY))
  useEffect(function showOneOnceItsPrinterAnswers() {
    if (screenInFront || heldBeforeThisLaunch.size === 0) return
    const ready = firstReadyToShow(heldBeforeThisLaunch, printers)
    if (!ready) return
    const [printerId, held] = ready
    forgetFor(HELD_REPORTS_KEY, printerId)
    setHeldBeforeThisLaunch(withoutThePrinter(heldBeforeThisLaunch, printerId))
    showPluginsLeftOff(held.reapplied)
  }, [printers, screenInFront, heldBeforeThisLaunch])
}
