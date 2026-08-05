// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { checkSshOpen } from '../printers/probe'

// SSH stays answering for a moment after the printer accepts the reboot, so "it is back" is only true
// after it has first gone away. If it never goes away inside GOING_DOWN_MS we stop waiting for that and
// go straight to watching for it to answer again, so a printer that reboots faster than we can see is
// never mistaken for one that refused.
const GOING_DOWN_MS = 45_000
const COMING_BACK_MS = 300_000
const POLL_MS = 2_000

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollUntilSshIs(answering: boolean, ip: string, giveUpAfterMs: number): Promise<boolean> {
  const deadline = Date.now() + giveUpAfterMs

  async function attempt(): Promise<boolean> {
    if (await checkSshOpen(ip) === answering) return true
    if (Date.now() >= deadline) return false
    await pause(POLL_MS)

    return attempt()
  }

  return attempt()
}

function untilThePrinterStopsAnswering(ip: string): Promise<boolean> {
  return pollUntilSshIs(false, ip, GOING_DOWN_MS)
}

function untilThePrinterAnswersAgain(ip: string): Promise<boolean> {
  return pollUntilSshIs(true, ip, COMING_BACK_MS)
}

// Blocks until the printer has gone down and answered again. A printer that never answers again inside
// COMING_BACK_MS throws, because the op reporting success would tell the user the printer is back when
// it is not.
export async function waitForThePrinterToComeBack(ip: string): Promise<void> {
  await untilThePrinterStopsAnswering(ip)
  const isBack = await untilThePrinterAnswersAgain(ip)
  if (!isBack) throw new Error('The printer has not come back on the network yet. Check its power and its WiFi, then try again.')
}
