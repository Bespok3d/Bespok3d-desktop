import { useState, useEffect } from 'react'
import type { Printer } from '../data/types'

export interface SshCredentials {
  user: string
  password: string
  port: number
}

export type EnrollPhase = 'credentials' | 'enrolling' | 'success' | 'failed'

type SshLifecycleOp = (printerId: string, ip: string, user: string, password: string, port: number) => Promise<void>

export interface EnrollState {
  phase: EnrollPhase
  latestEvent: EnrollProgressEvent | null
}

// The next phase implied by a progress event: a failure ends in 'failed', the final step's completion
// ends in 'success', anything else is still 'enrolling'.
function nextEnrollPhase(status: EnrollProgressEvent['status'], isLastStep: boolean): EnrollPhase {
  if (status === 'failed') return 'failed'
  if (status === 'done' && isLastStep) return 'success'

  return 'enrolling'
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
  function lifecycleStarter(op: SshLifecycleOp): (creds: SshCredentials) => void {
    return (creds) => startOp(() => op(printer.id, printer.ip, creds.user, creds.password, creds.port))
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

  return {
    state, startEnrollment, retryFrom, reset,
    startDeactivate: lifecycleStarter(printers.deactivate),
    startReactivate: lifecycleStarter(printers.reactivate),
    startUninstall: lifecycleStarter(printers.uninstall),
    startRepair: lifecycleStarter(printers.repair),
    startUpdateDaemon: lifecycleStarter(printers.updateDaemon),
    startUpdateJinni: lifecycleStarter(printers.updateJinni),
  }
}
