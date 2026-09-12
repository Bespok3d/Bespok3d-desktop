// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { checkDaemon } from '../printers'

// How much of the log an adapter is expected to hand back, named here because this is the file that
// puts a number in front of the user. Reading it off the printer belongs to the adapter: where the
// daemon writes its log is the printer's own fact, and the app used to hardcode the U1's path.
const DAEMON_LOG_TAIL_LINES = 200

export function formatDaemonStartFailure(logTail: string): string {
  const trimmed = logTail.trim()
  const baseMessage = 'Daemon did not start within the expected time'
  if (!trimmed) return baseMessage

  return `${baseMessage}\n\n--- daemon.log (last ${DAEMON_LOG_TAIL_LINES} lines) ---\n${trimmed}`
}

// Poll until the daemon answers on port 4269; on the final miss, surface the captured log tail so a
// start failure (import error, cert issue, bind failure) shows in the op modal instead of a bare timeout.
export async function waitForDaemon(ip: string, fetchLogTail?: () => Promise<string>, attemptsLeft = 10): Promise<void> {
  const isUp = await checkDaemon(ip)
  if (isUp) return
  if (attemptsLeft <= 1) {
    const logTail = fetchLogTail ? await fetchLogTail().catch(() => '') : ''
    throw new Error(formatDaemonStartFailure(logTail))
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 2000))

  return waitForDaemon(ip, fetchLogTail, attemptsLeft - 1)
}
