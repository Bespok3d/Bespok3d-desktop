// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { checkDaemon } from '../printers'
import { shellQuote } from '../ssh'
import type { SshSession } from '../ssh'

const DAEMON_LOG_TAIL_LINES = 200
const DAEMON_LOG_PATH = '/userdata/bespok3d/var/log/daemon.log'

export function tailDaemonLog(ssh: SshSession, logPath: string = DAEMON_LOG_PATH, lineCount: number = DAEMON_LOG_TAIL_LINES): Promise<string> {
  return ssh.exec(`tail -${Number(lineCount)} ${shellQuote(logPath)} 2>/dev/null || true`)
}

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
