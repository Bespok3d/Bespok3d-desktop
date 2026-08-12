// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { installB3d } from '../../test/b3d-mock'
import { waitForPrinterBack } from './wait-for-printer'

// The two waits the module works to, repeated here so a change to either fails a test rather than
// quietly changing what the user watches.
const STILL_GOING_DOWN_MS = 8_000
const ASK_AGAIN_MS = 3_000

function serving() {
  return { isManaged: true, reach: 'daemon' as const, sshOpen: true }
}

function notServing() {
  return { isManaged: false, reach: 'offline' as const, sshOpen: false }
}

afterEach(function realClockAgain() {
  vi.useRealTimers()
})

describe('waiting for a printer that was told to restart', () => {
  it('believes nothing it says while it is still on its way down', async () => {
    vi.useFakeTimers()
    const checkDaemon = vi.fn().mockResolvedValue(serving())
    installB3d({ printers: { checkDaemon } })

    const waiting = waitForPrinterBack('printer-1')
    await vi.advanceTimersByTimeAsync(STILL_GOING_DOWN_MS - 1_000)
    expect(checkDaemon).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2_000)
    await waiting
    expect(checkDaemon).toHaveBeenCalledWith('printer-1')
  })

  it('keeps asking until the daemon is the one answering, not just the printer', async () => {
    vi.useFakeTimers()
    const checkDaemon = vi.fn()
      .mockResolvedValueOnce(notServing())
      .mockResolvedValueOnce(notServing())
      .mockResolvedValue(serving())
    installB3d({ printers: { checkDaemon } })

    const waiting = waitForPrinterBack('printer-1')
    await vi.advanceTimersByTimeAsync(STILL_GOING_DOWN_MS + ASK_AGAIN_MS * 2)
    await waiting

    expect(checkDaemon).toHaveBeenCalledTimes(3)
  })

  it('stops waiting on a printer that never comes back, so the report is not held forever', async () => {
    vi.useFakeTimers()
    const checkDaemon = vi.fn().mockResolvedValue(notServing())
    installB3d({ printers: { checkDaemon } })

    const waiting = waitForPrinterBack('printer-1')
    await vi.advanceTimersByTimeAsync(200_000)

    await expect(waiting).resolves.toBeUndefined()
  })
})
