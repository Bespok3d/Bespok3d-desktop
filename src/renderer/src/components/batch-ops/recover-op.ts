// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { PluginRecoveryResult } from '@bespok3d/contract'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'
import { CHECKS_LEFT_KEY, forgetAllKeptFor, forgetFor, keepFor, keptFor } from './kept-over-a-quit'

// What the report says about the restart after recovery: none was made by the app, the app restarted
// the printer and it answered again, or the wait ran out before the printer's daemon answered.
export type RecoveryRestart = 'none' | 'restarted' | 'not-back'

interface RecoveryReportHandlers {
  waitForPrinterBack: (printerId: string) => Promise<boolean>
  setRestartingAfterRecovery: (restart: RecoveryRestart) => void
  showReport: (printerId: string, results: BatchResult) => void
}

// The printer's row saying the reboot replaced its services restart. The check those restarts would
// have had runs only once the printer is back, and its answer takes this row's place in the report.
const REBOOT_REPLACES_RESTART_PHASE = 'reboot-replaces-restart'

function leftItsCheckToTheReboot(row: PluginRecoveryResult): boolean {
  return row.log.some((logPhase) => logPhase.id === REBOOT_REPLACES_RESTART_PHASE)
}

// The check answers again for each plugin it switched off, so that plugin's earlier row, which said it
// was back, gives way to the check's. The rest of the check takes the place of the reboot's own row.
function laterWordOn(check: BatchResult, recoveredRow: PluginRecoveryResult): PluginRecoveryResult {
  return check.results.find((checkRow) => checkRow.pluginId === recoveredRow.pluginId) ?? recoveredRow
}

function rowsOnlyTheCheckHas(results: BatchResult, check: BatchResult): PluginRecoveryResult[] {
  const recoveredPluginIds = new Set(results.results.filter((row) => !leftItsCheckToTheReboot(row)).map((row) => row.pluginId))

  return check.results.filter((checkRow) => !recoveredPluginIds.has(checkRow.pluginId))
}

function withTheCheckAfterTheReboot(results: BatchResult, check: BatchResult): BatchResult {
  const checkOnlyRows = rowsOnlyTheCheckHas(results, check)

  return {
    ...results,
    ok: results.ok && check.ok,
    results: results.results.flatMap((row) => (leftItsCheckToTheReboot(row) ? checkOnlyRows : [laterWordOn(check, row)])),
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
      handlers.showReport(printerId, results)

      return undefined
    }
    handlers.setRestartingAfterRecovery('restarted')

    return handlers.waitForPrinterBack(printerId).then(function nowItCanBeRead(back) {
      if (back) return checkedAfterTheReboot(printerId, results).then((checked) => handlers.showReport(printerId, checked))
      handlers.setRestartingAfterRecovery('not-back')
      handlers.showReport(printerId, results)

      return undefined
    })
  }
}

// The report, the printer it is about, and the screen held up in front of it while the printer restarts.
// The report can open while another printer is selected, so it carries its own printer.
function useRecoveryReport() {
  const [recoveryResults, setRecoveryResults] = useState<BatchResult | null>(null)
  const [recoveryPrinterId, setRecoveryPrinterId] = useState<string | null>(null)
  const [restartingAfterRecovery, setRestartingAfterRecovery] = useState<RecoveryRestart>('none')
  const [printerRestarting, setPrinterRestarting] = useState(false)
  function showReport(printerId: string, results: BatchResult) {
    setPrinterRestarting(false)
    setRecoveryPrinterId(printerId)
    setRecoveryResults(results)
  }
  // Restarting the plugins (reactivate) switches off each one the printer could not put back and still
  // ends on its own success screen, so this report is the one place the user is told which. Nothing
  // restarts the printer after it here.
  function showPluginsLeftOff(printerId: string, reapplied: BatchResult) {
    setRestartingAfterRecovery('none')
    showReport(printerId, reapplied)
  }

  return { recoveryResults, setRecoveryResults, recoveryPrinterId, restartingAfterRecovery, setRestartingAfterRecovery, printerRestarting, setPrinterRestarting, showReport, showPluginsLeftOff }
}

// When the app could not restart the printer itself, the user restarts it from the window it opens
// instead, and only the app ever asks the printer for the check the recover left to that restart. It
// is kept, per printer, until that restart is done, or a plugin that breaks the printer once it is
// back would be neither taken off nor reported. A new recover of that printer replaces it, as it does
// on the printer, and removing the printer drops it. The restart bar is that printer's own length,
// whichever printer was recovered last.
function useCheckLeftToTheirRestart(handlers: RecoveryReportHandlers, report: ReturnType<typeof useRecoveryReport>, readRestartSeconds: (printerId: string) => void) {
  function keepForTheirRestart(printerId: string, results: BatchResult, restarting: boolean) {
    if (!restarting && results.results.some(leftItsCheckToTheReboot)) keepFor(CHECKS_LEFT_KEY, printerId, results)
  }
  function forgetTheCheckLeft(printerId: string) {
    forgetFor(CHECKS_LEFT_KEY, printerId)
  }
  function checkAfterTheirRestart(printerId: string) {
    const left = keptFor(CHECKS_LEFT_KEY, printerId)
    if (!left) return
    forgetTheCheckLeft(printerId)
    readRestartSeconds(printerId)
    report.setRecoveryResults(null)
    report.setPrinterRestarting(true)
    reportWhenThePrinterIsBack(printerId, left, handlers)(true)
  }

  return { keepForTheirRestart, forgetTheCheckLeft, checkAfterTheirRestart }
}

// The restart bar's length, read from the printer being restarted.
function useRestartSeconds(restartSecondsOf: (printerId: string) => Promise<number | null>) {
  const [restartSeconds, setRestartSeconds] = useState<number | null>(null)
  function readRestartSeconds(printerId: string) {
    restartSecondsOf(printerId).then(setRestartSeconds)
  }

  return { restartSeconds, readRestartSeconds }
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
  const report = useRecoveryReport()
  const [recovering, setRecovering] = useState(false)
  const { restartSeconds, readRestartSeconds } = useRestartSeconds(restartSecondsOf)
  const handlers = { waitForPrinterBack, setRestartingAfterRecovery: report.setRestartingAfterRecovery, showReport: report.showReport }
  const theirRestart = useCheckLeftToTheirRestart(handlers, report, readRestartSeconds)
  function restartThenReport(printerId: string, results: BatchResult) {
    setRecovering(false)
    report.setPrinterRestarting(true)

    return restartAfterReapply(printerId).then(function reportAfterTheRestart(restarting) {
      theirRestart.keepForTheirRestart(printerId, results, restarting)

      return reportWhenThePrinterIsBack(printerId, results, handlers)(restarting)
    })
  }
  function runRecover(printerId: string) {
    setRecovering(true)
    readRestartSeconds(printerId)
    report.setRestartingAfterRecovery('none')
    report.setPrinterRestarting(false)
    // A recover puts every plugin back, so nothing kept about the printer before it is still true.
    forgetAllKeptFor(printerId)
    appRestartsItself(printerId)
      .then((rebootFollows) => window.b3d.store.recover(printerId, rebootFollows))
      .then((results) => restartThenReport(printerId, results))
      .catch(recoveryDidNotRun(printerId, function clearBothWaits(busy: boolean) {
        setRecovering(busy)
        report.setPrinterRestarting(busy)
      }))
  }

  return {
    recoveryResults: report.recoveryResults, setRecoveryResults: report.setRecoveryResults, recoveryPrinterId: report.recoveryPrinterId, recovering, restartingAfterRecovery: report.restartingAfterRecovery,
    printerRestarting: report.printerRestarting, restartSeconds, runRecover, showPluginsLeftOff: report.showPluginsLeftOff, checkAfterTheirRestart: theirRestart.checkAfterTheirRestart,
  }
}
