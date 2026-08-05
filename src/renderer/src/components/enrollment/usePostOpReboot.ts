// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef } from 'react'
import type { Printer } from '../../data/types'
import type { SshCredentials, EnrollPhase } from '../../hooks/enrollment'
import { usePrintState } from '../plugin-store/usePrintState'
import type { EnrollMode } from './index'

// The three ops that leave the printer running something other than what is now on disk: stopping the
// plugins, starting them again, and removing bespok3d (which re-locks the write layer, and only a boot
// applies that). Each one reboots the printer when it finishes.
//
// Stopping and restarting the plugins hold the modal on the reboot until the printer is back, so Done
// means the printer is up and running what it now has on disk. Removing bespok3d has nothing left to
// come back to and the printer is no longer ours to report on, so its own success screen is shown at
// once, saying the printer is rebooting.
const OPS_THAT_WAIT_FOR_THE_PRINTER: ReadonlySet<EnrollMode> = new Set<EnrollMode>(['deactivate', 'reactivate'])

export type PostOpReboot = 'wait-for-the-printer' | 'reboot-behind-the-success-screen' | 'no-reboot'

export function postOpReboot(mode: EnrollMode, printerBusyPrinting: boolean): PostOpReboot {
  if (printerBusyPrinting) return 'no-reboot'
  if (OPS_THAT_WAIT_FOR_THE_PRINTER.has(mode)) return 'wait-for-the-printer'

  return mode === 'uninstall' ? 'reboot-behind-the-success-screen' : 'no-reboot'
}

// The two ways this modal asks for the reboot. Waiting for the printer keeps the modal on the reboot,
// so Done means the printer is back. Removal has already shown its own success screen, and the progress
// subscription only listens while an op is running, so that one goes straight down the IPC and leaves
// the screen standing. Either way the app is told to expect the printer to drop off and come back.
export function postOpRebootCalls(printer: Printer, startReboot: (creds: SshCredentials) => void, onExpectedRestart?: (printerId: string) => void) {
  function rebootAndWatchIt(creds: SshCredentials) {
    if (onExpectedRestart) onExpectedRestart(printer.id)
    startReboot(creds)
  }
  function rebootWithoutTakingOverTheScreen(creds: SshCredentials) {
    if (onExpectedRestart) onExpectedRestart(printer.id)
    window.b3d.printers.reboot(printer.id, printer.ip, creds.user, creds.password, creds.port)
      .catch((error) => console.error('[enroll] the reboot after removing bespok3d failed', error))
  }

  return { startReboot: rebootAndWatchIt, rebootWithoutTakingOverTheScreen }
}

interface PostOpRebootPlan {
  printer: Printer
  mode: EnrollMode
  phase: EnrollPhase
  credentials: SshCredentials
  startReboot: (creds: SshCredentials) => void
  rebootWithoutTakingOverTheScreen: (creds: SshCredentials) => void
}

// Reboots the printer the moment the op reports success, and answers whether the success screen has to
// say so. A printer seen printing at any point while this modal is open is left alone: stopping or
// removing bespok3d takes the live print feed away with it, so the print outlives what the app can
// still see of it.
export function usePostOpReboot(plan: PostOpRebootPlan): boolean {
  const { printActive } = usePrintState(plan.printer)
  const wasPrinting = useRef(false)
  const rebootStarted = useRef(false)

  function rememberAPrintWasRunning() {
    if (printActive) wasPrinting.current = true
  }
  useEffect(rememberAPrintWasRunning, [printActive])

  const plannedReboot = postOpReboot(plan.mode, printActive || wasPrinting.current)

  function rebootOnceTheOpSucceeds() {
    if (plan.phase !== 'success' || rebootStarted.current || plannedReboot === 'no-reboot') return
    rebootStarted.current = true
    const runIt = plannedReboot === 'wait-for-the-printer' ? plan.startReboot : plan.rebootWithoutTakingOverTheScreen
    runIt(plan.credentials)
  }
  useEffect(rebootOnceTheOpSucceeds, [plan.phase])

  return plan.phase === 'success' && plannedReboot === 'reboot-behind-the-success-screen'
}
