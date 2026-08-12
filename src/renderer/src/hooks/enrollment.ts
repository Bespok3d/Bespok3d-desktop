// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import { mainProcessMessage } from '../utils/errorMessage'
import type { Printer } from '../data/types'

export interface SshCredentials {
  user: string
  password: string
  port: number
}

export type EnrollPhase = 'credentials' | 'enrolling' | 'success' | 'failed' | 'cancelled'

type SshLifecycleOp = (printerId: string, ip: string, user: string, password: string, port: number) => Promise<void>

export interface EnrollState {
  phase: EnrollPhase
  latestEvent: EnrollProgressEvent | null
  // Why the operation never got going, when it never got going. The progress feed only reports on an
  // operation the printer actually started, so a call refused before that has no other way onto the
  // screen and used to leave the modal on a bar that would never move.
  startError?: string
  // The operation was asked for, nothing was refused, and the printer still has not reported a first
  // step. Nothing more will arrive on its own, so the modal has to stop pretending it is working.
  silentSinceStart?: boolean
}

// Longer than every bounded wait between the click and the first step: the login gives up at 15s and
// the version read at 5s, so past this the printer is not going to answer at all.
const NO_FIRST_STEP_MS = 30000

// A started operation reports its first step as soon as it has one. This watches for the case where
// none ever arrives, which is the one case the progress feed cannot report on: it is not there.
function useSilenceSinceStart(stillWaiting: boolean, onSilence: () => void): void {
  useEffect(() => {
    if (!stillWaiting) return
    const timer = setTimeout(onSilence, NO_FIRST_STEP_MS)

    return () => clearTimeout(timer)
  }, [stillWaiting])
}

function couldNotStart(detail: string): EnrollState {
  return { phase: 'enrolling', latestEvent: null, startError: detail }
}

// Asked for, not refused, and no first step yet: the one state the progress feed cannot report on.
function waitingOnAFirstStep(state: EnrollState): boolean {
  return state.phase === 'enrolling' && !state.latestEvent && !state.startError && !state.silentSinceStart
}

// The next phase implied by a progress event: a failure ends in 'failed', the final step's completion
// ends in 'success', anything else is still 'enrolling'.
function nextEnrollPhase(status: EnrollProgressEvent['status'], isLastStep: boolean): EnrollPhase {
  if (status === 'failed') return 'failed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'done' && isLastStep) return 'success'

  return 'enrolling'
}

// Every lifecycle op the app runs over SSH takes the same arguments and reports on the same progress
// feed, so they are all the one shape: name the op, get the starter that runs it on this printer.
function sshLifecycleStarters(printer: Printer, startOp: (invoke: () => Promise<void>) => void, forced: boolean) {
  const printers = window.b3d.printers
  function starterFor(op: SshLifecycleOp): (creds: SshCredentials) => void {
    return (creds) => startOp(() => op(printer.id, printer.ip, creds.user, creds.password, creds.port))
  }

  return {
    startDeactivate: starterFor(printers.deactivate),
    startReactivate: starterFor(printers.reactivate),
    startUninstall: starterFor(printers.uninstall),
    startReboot: starterFor(printers.reboot),
    // Repair is the one op on this list the Force menu launches, so it is the one that carries the flag.
    startRepair: (creds: SshCredentials) => startOp(() => printers.repair(printer.id, printer.ip, creds.user, creds.password, creds.port, forced)),
    startUpdateDaemon: starterFor(printers.updateDaemon),
    startUpdateJinni: starterFor(printers.updateJinni),
  }
}

// forced: the user launched this from the Force menu, which waives the check that refuses to put a
// printer back onto an older daemon than it is running. It never waives the running-print refusal.
export function useEnrollment(printer: Printer, forced = false) {
  const [state, setState] = useState<EnrollState>({ phase: 'credentials', latestEvent: null })

  useEffect(() => {
    if (state.phase !== 'enrolling') return
    const unsub = window.b3d.printers.onEnrollProgress((event) => {
      if (event.printerId !== printer.id) return
      const isLastStep = event.stepIndex === event.totalSteps - 1
      const nextPhase = nextEnrollPhase(event.status, isLastStep)
      setState({ phase: nextPhase, latestEvent: event })
    })

    return unsub
  }, [state.phase, printer.id])

  function noteSilence(): void {
    setState((prev) => ({ ...prev, silentSinceStart: true }))
  }
  useSilenceSinceStart(waitingOnAFirstStep(state), noteSilence)

  const printers = window.b3d.printers
  // The operation never reached the printer, so nothing will ever arrive on the progress feed: say why
  // on screen rather than leaving the user watching a bar that cannot move.
  function failStart(detail: string): void {
    setState(couldNotStart(detail))
  }
  function startOp(invoke: () => Promise<void>): void {
    setState({ phase: 'enrolling', latestEvent: null })
    // The UI's progress and terminal failed/success state arrive on the onEnrollProgress ws feed above,
    // not this POST promise; a rejection here means the operation never started, so it goes on screen.
    invoke().catch((error) => failStart(mainProcessMessage(error)))
  }
  function startEnrollment(creds: SshCredentials): void {
    startOp(() => printers.enroll(printer.id, printer.ip, printer.adapter, creds.user, creds.password, creds.port, undefined, forced))
  }
  // A retry waits on the printer exactly as the first try did, so it starts the same way: the step it
  // failed on goes off screen with it. Keeping that step there told the modal a printer had answered,
  // and the watch that offers the way out never started.
  function retryFrom(stepId: string, creds: SshCredentials): void {
    startOp(() => printers.enroll(printer.id, printer.ip, printer.adapter, creds.user, creds.password, creds.port, stepId, forced))
  }
  function reset(): void {
    setState({ phase: 'credentials', latestEvent: null })
  }
  // The steps run on the printer, so the app cannot take back the one in flight: it asks the main
  // process to stop before the next step and waits on the feed for the cancelled event.
  function cancelOp(): void {
    printers.cancelOp(printer.id).catch((error) => console.error('[enroll] cancel IPC failed', error))
  }

  return { state, startEnrollment, retryFrom, reset, cancelOp, failStart, ...sshLifecycleStarters(printer, startOp, forced) }
}
