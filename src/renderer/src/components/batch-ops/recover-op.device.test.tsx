// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { execFile } from 'node:child_process'
import { connect } from 'node:net'
import { setup, realI18nValue } from '../../test/harness'
import { useRecoverOp } from './recover-op'
import { waitForPrinterBack } from './wait-for-printer'
import { BatchOpModal } from './index'
import type { RecoverResult } from '@bespok3d/contract'

type DaemonReport = Awaited<ReturnType<typeof window.b3d.printers.checkDaemon>>

// The watch a jsdom test cannot do: a real printer really restarting, which takes minutes, with the
// screen sampled the whole way. It runs only when a printer is named, so the app's own check suite
// never reaches for hardware:
//
//   B3D_HIL_HOST=<printer ip> B3D_HIL_SSH=<ssh host> npx vitest run src/renderer/src/components/batch-ops/recover-op.device.test.tsx
const PRINTER_IP = process.env.B3D_HIL_HOST ?? ''
const PRINTER_SSH = process.env.B3D_HIL_SSH ?? 'u1jr'
const PRINTER_PASSWORD = process.env.B3D_HIL_PASSWORD ?? 'snapmaker'
// The port the printer's own Bespok3d service listens on: an answer from it is what says the printer
// is back, since SSH opens well before it is serving.
const DAEMON_PORT = 4269
// How often the screen is looked at, and how long a real restart is given before the watch gives up.
const LOOK_AGAIN_MS = 2_000
const ASK_AGAIN_MS = 3_000
const GONE_BY_MS = 45_000
const WATCH_LIMIT_MS = 420_000
const RESTARTING_SCREEN = 'the printer is restarting'
const { t } = realI18nValue()

function noop() {}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function onThePrinter(command: string): Promise<boolean> {
  const args = ['-p', PRINTER_PASSWORD, 'ssh', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'ConnectTimeout=5', PRINTER_SSH, command]

  return new Promise((resolve) => execFile('sshpass', args, (refused) => resolve(!refused)))
}

function waitForSsh(answering: boolean, until: number): Promise<void> {
  return onThePrinter('true').then(function askAgainUnlessItChanged(answered) {
    if (answered === answering || Date.now() >= until) return undefined

    return pause(ASK_AGAIN_MS).then(() => waitForSsh(answering, until))
  })
}

// What the app's own restart does to a printer it manages: ask for the power cycle, watch it go, and
// answer only once it is answering again. Minutes, not milliseconds, which is the whole point here.
function restartTheRealPrinter(): Promise<boolean> {
  return onThePrinter('reboot')
    .then(() => waitForSsh(false, Date.now() + GONE_BY_MS))
    .then(() => waitForSsh(true, Date.now() + WATCH_LIMIT_MS))
    .then(() => true)
}

function theDaemonAnswers(): Promise<DaemonReport> {
  return new Promise((resolve) => {
    var socket = connect({ host: PRINTER_IP, port: DAEMON_PORT, timeout: 4_000 })
    function sayWhetherItAnswered(serving: boolean) {
      socket.destroy()
      resolve({ isManaged: serving, sshOpen: serving, reach: serving ? 'managed' : 'offline' })
    }
    socket.on('connect', () => sayWhetherItAnswered(true))
    socket.on('error', () => sayWhetherItAnswered(false))
    socket.on('timeout', () => sayWhetherItAnswered(false))
  })
}

// One plugin that did not come back, because the report naming it is the thing the user loses when
// the window closes. The recovery itself is not what is under watch here, the restart is.
const ONE_PLUGIN_LEFT_BEHIND: RecoverResult = {
  ok: false,
  results: [
    { pluginId: 'fluidd', ok: false, skipped: false, reason: 'reinstall it from its own page', log: [] },
  ],
}

function refusalIsNotUnderTest() {
  return function ignoreRefusal() {}
}

// The recovery modals the user actually looks at, driven by the real hook, the real wait and a real
// printer restart.
function RecoveryOnARealPrinter() {
  const recoverOp = useRecoverOp(restartTheRealPrinter, refusalIsNotUnderTest, waitForPrinterBack, () => Promise.resolve(42))

  return (
    <>
      <button type="button" onClick={() => recoverOp.runRecover('printer-1')}>recover</button>
      <BatchOpModal
        variant="recovery"
        busy={recoverOp.recovering}
        result={recoverOp.recoveryResults}
        restarting={recoverOp.restartingAfterRecovery}
        printerRestarting={recoverOp.printerRestarting}
        failure={null}
        onRepairPrinter={noop}
        onOpenPlugin={noop}
        onClose={noop}
        onDismissFailure={noop}
      />
    </>
  )
}

function whatIsOnScreen(): string {
  if (screen.queryByText(t('recovery_restart.body'))) return RESTARTING_SCREEN
  if (screen.queryByRole('dialog')) return 'some other window'

  return 'nothing at all'
}

function keepLookingAtTheScreen(everySample: string[]) {
  const timer = setInterval(function takeOneLook() {
    everySample.push(whatIsOnScreen())
  }, LOOK_AGAIN_MS)

  return function stopLooking() {
    clearInterval(timer)
  }
}

describe.skipIf(!PRINTER_IP)('recovery watched on a real printer', () => {
  it('keeps the restarting screen up for the whole restart, then opens the report', async () => {
    const recover = vi.fn().mockResolvedValue(ONE_PLUGIN_LEFT_BEHIND)
    const { user } = setup(<RecoveryOnARealPrinter />, {
      withCatalog: true,
      b3d: { store: { recover }, printers: { checkDaemon: theDaemonAnswers } },
    })
    const everySample: string[] = []

    await user.click(screen.getByRole('button', { name: 'recover' }))
    expect(whatIsOnScreen()).toBe(RESTARTING_SCREEN)
    const stopLooking = keepLookingAtTheScreen(everySample)
    await waitFor(() => expect(screen.getByText(t('recovery_results.title_errors'))).toBeInTheDocument(), { timeout: WATCH_LIMIT_MS, interval: LOOK_AGAIN_MS })
    stopLooking()

    expect(everySample.filter(function notTheRestartingScreen(frame) { return frame !== RESTARTING_SCREEN })).toEqual([])
    expect(everySample.length).toBeGreaterThan(15)
    expect(screen.getAllByText(/fluidd/i).length).toBeGreaterThan(0)
  }, WATCH_LIMIT_MS)
})
