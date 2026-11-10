// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sshOpen = vi.fn()
vi.mock('../printers/probe', () => ({ checkSshOpen: (ip: string, sshPort: number) => sshOpen(ip, sshPort) }))

import { waitForThePrinterToComeBack } from './reboot-wait'

// The polls are minutes long; run them on fake timers so the test stays instant.
function answersInThisOrder(answers: boolean[]): void {
  sshOpen.mockReset()
  answers.forEach((answer) => sshOpen.mockResolvedValueOnce(answer))
  sshOpen.mockResolvedValue(answers[answers.length - 1])
}

describe('waiting for a rebooted printer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('only reports the printer back once it has gone away and answered again', async () => {
    answersInThisOrder([true, false, false, true])
    const waiting = expect(waitForThePrinterToComeBack('192.0.2.1', 22)).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(20_000)

    await waiting
  })

  it('says so instead of claiming success when the printer never comes back', async () => {
    answersInThisOrder([false])
    const waiting = expect(waitForThePrinterToComeBack('192.0.2.1', 22)).rejects.toThrow('has not come back on the network')
    await vi.advanceTimersByTimeAsync(400_000)

    await waiting
  })

  it('asks on the SSH port it was given, so a printer on another port is seen coming back', async () => {
    answersInThisOrder([true, false, true])
    const waiting = expect(waitForThePrinterToComeBack('192.0.2.1', 2222)).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(20_000)

    await waiting
    expect(sshOpen).toHaveBeenCalledWith('192.0.2.1', 2222)
    expect(sshOpen).not.toHaveBeenCalledWith('192.0.2.1', 22)
  })
})
