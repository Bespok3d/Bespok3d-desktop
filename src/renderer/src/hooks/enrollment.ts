// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
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
function sshLifecycleStarters(printer: Printer, startOp: (invoke: () => Promise<void>) => void) {
  const printers = window.b3d.printers
  function starterFor(op: SshLifecycleOp): (creds: SshCredentials) => void {
    return (creds) => startOp(() => op(printer.id, printer.ip, creds.user, creds.password, creds.port))
  }

  return {
    startDeactivate: starterFor(printers.deactivate),
    startReactivate: starterFor(printers.reactivate),
    startUninstall: starterFor(printers.uninstall),
    startReboot: starterFor(printers.reboot),
    startRepair: starterFor(printers.repair),
    startUpdateDaemon: starterFor(printers.updateDaemon),
    startUpdateJinni: starterFor(printers.updateJinni),
  }
}

export function useEnrollment(printer: Printer) {
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

  const printers = window.b3d.printers
  function startOp(invoke: () => Promise<void>): void {
    setState({ phase: 'enrolling', latestEvent: null })
    // The UI's progress and terminal failed/success state arrive on the onEnrollProgress ws feed above,
    // not this POST promise; a rejection here means the IPC dispatch itself failed, so log it (don't swallow).
    invoke().catch((error) => console.error('[enroll] start-op IPC failed', error))
  }
  function startEnrollment(creds: SshCredentials): void {
    startOp(() => printers.enroll(printer.id, printer.ip, printer.adapter, creds.user, creds.password, creds.port))
  }
  function retryFrom(stepId: string, creds: SshCredentials): void {
    setState((prev) => ({ ...prev, phase: 'enrolling' }))
    // Same as startOp: the retry's progress and outcome arrive via onEnrollProgress; a rejection here is an IPC dispatch failure, so log it.
    printers.enroll(printer.id, printer.ip, printer.adapter, creds.user, creds.password, creds.port, stepId).catch((error) => console.error('[enroll] retry IPC failed', error))
  }
  function reset(): void {
    setState({ phase: 'credentials', latestEvent: null })
  }
  // The steps run on the printer, so the app cannot take back the one in flight: it asks the main
  // process to stop before the next step and waits on the feed for the cancelled event.
  function cancelOp(): void {
    printers.cancelOp(printer.id).catch((error) => console.error('[enroll] cancel IPC failed', error))
  }

  return { state, startEnrollment, retryFrom, reset, cancelOp, ...sshLifecycleStarters(printer, startOp) }
}
