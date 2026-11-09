// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { PluginRecoveryResult } from '@bespok3d/contract'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'

// What the report says about the restart after recovery: none was made by the app, the app restarted
// the printer and it answered again, or the wait ran out before the printer's daemon answered.
export type RecoveryRestart = 'none' | 'restarted' | 'not-back'

interface RecoveryReportHandlers {
  waitForPrinterBack: (printerId: string) => Promise<boolean>
  setRestartingAfterRecovery: (restart: RecoveryRestart) => void
  showReport: (results: BatchResult) => void
}

// The printer's row saying the reboot replaced its services restart. The check those restarts would
// have had runs only once the printer is back, and its answer takes this row's place in the report.
const REBOOT_REPLACES_RESTART_PHASE = 'reboot-replaces-restart'

function leftItsCheckToTheReboot(row: PluginRecoveryResult): boolean {
  return row.log.some((logPhase) => logPhase.id === REBOOT_REPLACES_RESTART_PHASE)
}

function withTheCheckAfterTheReboot(results: BatchResult, check: BatchResult): BatchResult {
  return {
    ...results,
    ok: results.ok && check.ok,
    results: results.results.flatMap((row) => (leftItsCheckToTheReboot(row) ? check.results : [row])),
  }
}

// A check that still did not run leaves the report as the recover gave it.
function checkedAfterTheReboot(printerId: string, results: BatchResult): Promise<BatchResult> {
  if (!results.results.some(leftItsCheckToTheReboot)) return Promise.resolve(results)

  return window.b3d.store.recoverAfterReboot(printerId)
    .then((check) => withTheCheckAfterTheReboot(results, check))
    .catch(function reportWithoutTheCheck(error) {
      console.error('[recover] the check after the reboot did not run', error)

      return results
    })
}

// The report is held until the printer answers again. Showing it the moment the plugins were back is
// what put "recovery complete" on screen over a printer that was still rebooting, with nothing on
// screen to say a restart had even started.
//
// The restart answers whether the app is making it itself. A printer the user gave their own SSH login
// for is not restarted unattended, so there is nothing to wait for and that one is reported at once.
// A wait that runs out still shows the report, saying the daemon did not answer, and starts nothing else.
function reportWhenThePrinterIsBack(printerId: string, results: BatchResult, handlers: RecoveryReportHandlers) {
  return function holdTheReport(restarting: boolean) {
    if (!restarting) {
      handlers.setRestartingAfterRecovery('none')
      handlers.showReport(results)

      return undefined
    }
    handlers.setRestartingAfterRecovery('restarted')

    return handlers.waitForPrinterBack(printerId).then(function nowItCanBeRead(back) {
      if (back) return checkedAfterTheReboot(printerId, results).then(handlers.showReport)
      handlers.setRestartingAfterRecovery('not-back')
      handlers.showReport(results)

      return undefined
    })
  }
}

// Recovery, the one batch operation that ends by restarting the printer: putting every plugin back
// leaves services restarted one after another, and the touchscreen is known to come back dead from
// that, so the printer is restarted every time rather than only when something says it must be.
// When the app will make that restart itself, the printer is told so before recovery runs and skips
// its own services restart, which the reboot replaces.
//
// The restarting screen goes up when the restart is ASKED FOR, never when it answers: the answer only
// comes once the printer has gone down and rejoined the network, minutes later. Waiting for it left the
// plugins-going-back screen down, the report not yet up and every window closed for the whole reboot,
// which is what told the user recovery was over while their printer was still restarting. The printer's
// own restart length is read at that same moment, so the bar has it before the wait starts.
export function useRecoverOp(
  restartAfterReapply: (printerId: string) => Promise<boolean>,
  recoveryDidNotRun: (printerId: string, setBusy: (busy: boolean) => void) => (error: unknown) => void,
  waitForPrinterBack: (printerId: string) => Promise<boolean>,
  restartSecondsOf: (printerId: string) => Promise<number | null>,
  appRestartsItself: (printerId: string) => Promise<boolean>,
) {
  const [recoveryResults, setRecoveryResults] = useState<BatchResult | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [restartingAfterRecovery, setRestartingAfterRecovery] = useState<RecoveryRestart>('none')
  const [printerRestarting, setPrinterRestarting] = useState(false)
  const [restartSeconds, setRestartSeconds] = useState<number | null>(null)
  function showReport(results: BatchResult) {
    setPrinterRestarting(false)
    setRecoveryResults(results)
  }
  function runRecover(printerId: string) {
    setRecovering(true)
    restartSecondsOf(printerId).then(setRestartSeconds)
    setRestartingAfterRecovery('none')
    setPrinterRestarting(false)
    appRestartsItself(printerId)
      .then((rebootFollows) => window.b3d.store.recover(printerId, rebootFollows))
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
