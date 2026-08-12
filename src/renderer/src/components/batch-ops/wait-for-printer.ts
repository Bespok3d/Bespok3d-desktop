// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A printer that has just been told to restart is still answering for a few seconds, so asking it
// straight away gets an answer from the printer on its way down and reads it as one that has come
// back. The first question waits until it has actually gone.
const GOING_DOWN_MS = 8_000
// How often it is asked afterwards. Often enough that the user is not left waiting on a printer that
// is already up, rare enough that a restarting printer is not hammered with SSH.
const ASK_AGAIN_MS = 3_000
// A printer that has not answered by here is not coming back on its own. The wait ends anyway rather
// than holding the report hostage: the user gets what recovery did, and the printer list keeps showing
// it offline until it returns.
const STOP_WAITING_MS = 180_000

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Only a managed answer counts as back: SSH opens well before the daemon is serving, and reporting on
// the strength of an open port is what shows a success screen over a printer that is still booting.
function printerIsServingAgain(printerId: string): Promise<boolean> {
  return window.b3d.printers.checkDaemon(printerId)
    .then((report) => report?.isManaged === true)
    .catch(() => false)
}

function askUntilItAnswers(printerId: string, stopAt: number, clock: () => number): Promise<void> {
  return printerIsServingAgain(printerId).then(function askAgainUnlessItIsBack(back) {
    if (back || clock() >= stopAt) return undefined

    return pause(ASK_AGAIN_MS).then(() => askUntilItAnswers(printerId, stopAt, clock))
  })
}

// Resolves when the printer is serving again, or when the wait has gone on too long. It never rejects:
// the caller has a recovery report to show either way, and a failed question is just one more printer
// that is not back yet.
export function waitForPrinterBack(printerId: string, clock: () => number = Date.now): Promise<void> {
  const stopAt = clock() + STOP_WAITING_MS

  return pause(GOING_DOWN_MS).then(() => askUntilItAnswers(printerId, stopAt, clock))
}
