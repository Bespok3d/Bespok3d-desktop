// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef } from 'react'
import type { Printer } from '../../data/types'
import type { PrinterRecord } from '../../env'
import type { EnrollPhase } from '../../hooks/enrollment'
import { savedRecord } from '../../data/printers'

interface OpOutcomeWiring {
  printer: Printer
  phase: EnrollPhase
  waitsForTheReboot: boolean
  onEnrolled: (updated: Printer) => void
  onOpRecorded?: (updated: Printer) => void
  onClose: () => void
}

export interface OpOutcome {
  reportDone: () => void
  closeTheWindow: () => void
}

// How the app hears that the op is done. Done tells it once, however often it is pressed. Once the op
// went through the printer is already changed, so closing the window tells it too, whatever screen is
// still up. An op that holds the window on the printer's reboot is done when that reboot starts, so the
// app is shown the saved printer right then, and closing on a failed reboot after it only closes.
export function useOpOutcome(wiring: OpOutcomeWiring): OpOutcome {
  const opWentThrough = useRef(false)
  const opRecorded = useRef(false)
  const doneReported = useRef(false)

  function showTheAppTheSavedPrinter(record: PrinterRecord | undefined) {
    if (!record || !wiring.onOpRecorded) return
    opRecorded.current = true
    wiring.onOpRecorded({ ...wiring.printer, ...record })
  }
  function noteTheOpWentThrough() {
    if (wiring.phase !== 'success' || opWentThrough.current) return
    opWentThrough.current = true
    if (!wiring.waitsForTheReboot) return
    savedRecord(wiring.printer.id).then(showTheAppTheSavedPrinter)
      .catch((error) => console.error('[enroll] could not read the saved printer after the op', error))
  }
  useEffect(noteTheOpWentThrough, [wiring.phase])

  function reportDone() {
    if (doneReported.current) return
    doneReported.current = true
    savedRecord(wiring.printer.id)
      .then((record) => wiring.onEnrolled(record ? { ...wiring.printer, ...record } : { ...wiring.printer, status: 'managed' }))
      .catch(wiring.onClose)
  }
  function closeTheWindow() {
    if (opWentThrough.current && !opRecorded.current) reportDone()
    else wiring.onClose()
  }

  return { reportDone, closeTheWindow }
}
