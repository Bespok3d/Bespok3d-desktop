// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { RecoverResult } from '@bespok3d/contract'

interface RecoveryReportHandlers {
  waitForPrinterBack: (printerId: string) => Promise<void>
  setRestartingAfterRecovery: (restarting: boolean) => void
  showReport: (results: RecoverResult) => void
}

// The report is held until the printer answers again. Showing it the moment the plugins were back is
// what put "recovery complete" on screen over a printer that was still rebooting, with nothing on
// screen to say a restart had even started.
//
// The restart answers whether the app is making it itself. A printer the user gave their own SSH login
// for is not restarted unattended, so there is nothing to wait for and that one is reported at once.
function reportWhenThePrinterIsBack(printerId: string, results: RecoverResult, handlers: RecoveryReportHandlers) {
  return function holdTheReport(restarting: boolean) {
    handlers.setRestartingAfterRecovery(restarting)
    if (!restarting) {
      handlers.showReport(results)

      return undefined
    }

    return handlers.waitForPrinterBack(printerId).then(function nowItCanBeRead() {
      handlers.showReport(results)
    })
  }
}

// Recovery, the one batch operation that ends by restarting the printer: putting every plugin back
// leaves services restarted one after another, and the touchscreen is known to come back dead from
// that, so the printer is restarted every time rather than only when something says it must be.
//
// The restarting screen goes up when the restart is ASKED FOR, never when it answers: the answer only
// comes once the printer has gone down and rejoined the network, minutes later. Waiting for it left the
// plugins-going-back screen down, the report not yet up and every window closed for the whole reboot,
// which is what told the user recovery was over while their printer was still restarting. The printer's
// own restart length is read at that same moment, so the bar has it before the wait starts.
export function useRecoverOp(
  restartAfterReapply: (printerId: string) => Promise<boolean>,
  recoveryDidNotRun: (printerId: string, setBusy: (busy: boolean) => void) => (error: unknown) => void,
  waitForPrinterBack: (printerId: string) => Promise<void>,
  restartSecondsOf: (printerId: string) => Promise<number | null>,
) {
  const [recoveryResults, setRecoveryResults] = useState<RecoverResult | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [restartingAfterRecovery, setRestartingAfterRecovery] = useState(false)
  const [printerRestarting, setPrinterRestarting] = useState(false)
  const [restartSeconds, setRestartSeconds] = useState<number | null>(null)
  function showReport(results: RecoverResult) {
    setPrinterRestarting(false)
    setRecoveryResults(results)
  }
  function runRecover(printerId: string) {
    setRecovering(true)
    restartSecondsOf(printerId).then(setRestartSeconds)
    setRestartingAfterRecovery(false)
    setPrinterRestarting(false)
    window.b3d.store.recover(printerId)
      .then((results) => {
        setRecovering(false)
        setPrinterRestarting(true)

        return restartAfterReapply(printerId).then(reportWhenThePrinterIsBack(printerId, results, { waitForPrinterBack, setRestartingAfterRecovery, showReport }))
      })
      .catch(recoveryDidNotRun(printerId, function clearBothWaits(busy: boolean) {
        setRecovering(busy)
        setPrinterRestarting(busy)
      }))
  }

  return { recoveryResults, setRecoveryResults, recovering, restartingAfterRecovery, printerRestarting, restartSeconds, runRecover }
}
