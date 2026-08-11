// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BrowserWindow } from 'electron'

vi.mock('../ssh', () => ({ connect: vi.fn() }))

import { execOpSteps, runSshOp } from './op-runner'
import type { OpStep } from './op-runner'
import { connect } from '../ssh'

function fakeWindow() {
  const send = vi.fn()

  return { win: { webContents: { send } } as unknown as BrowserWindow, send }
}

function step(id: string, run: OpStep['run']): OpStep {
  return { id, label: id, detail: `detail ${id}`, run }
}

// How far into its step each hint said it was, in the order the renderer received them.
function hintedFractions(send: ReturnType<typeof fakeWindow>['send']): (number | undefined)[] {
  return send.mock.calls
    .map((call) => call[1] as { hint?: string; stepFraction?: number })
    .filter((event) => event.hint !== undefined)
    .map((event) => event.stepFraction)
}

describe('execOpSteps', () => {
  it('runs every step in order and emits a done event per step', async () => {
    const order: string[] = []
    const { win, send } = fakeWindow()
    await execOpSteps(win, 'p1', [
      step('one', async () => { order.push('one') }),
      step('two', async () => { order.push('two') }),
    ])
    expect(order).toEqual(['one', 'two'])
    const doneEvents = send.mock.calls.filter((call) => (call[1] as { status: string }).status === 'done')
    expect(doneEvents).toHaveLength(2)
  })

  it('stops at the first failing step, emits a failed event with the error, and throws', async () => {
    const order: string[] = []
    const { win, send } = fakeWindow()
    await expect(execOpSteps(win, 'p1', [
      step('one', async () => { order.push('one') }),
      step('boom', async () => { throw new Error('kaboom') }),
      step('three', async () => { order.push('three') }),
    ])).rejects.toThrow('Operation failed')
    expect(order).toEqual(['one'])
    const failed = send.mock.calls.find((call) => (call[1] as { status: string }).status === 'failed')
    expect((failed?.[1] as { error: string }).error).toContain('kaboom')
  })

  it('forwards a step progress hint as a running event', async () => {
    const { win, send } = fakeWindow()
    await execOpSteps(win, 'p1', [step('one', async (progress) => progress('halfway'))])
    const hinted = send.mock.calls.find((call) => (call[1] as { hint?: string }).hint === 'halfway')
    expect(hinted).toBeDefined()
  })

  it('carries the last measured progress forward, so an unmeasured hint never drops the bar back', async () => {
    const { win, send } = fakeWindow()
    await execOpSteps(win, 'p1', [step('one', async (progress) => {
      progress('uploading 60/60', 0.75)
      progress('installing dependencies…')
    })])
    expect(hintedFractions(send)).toEqual([0.75, 0.75])
  })
})

describe('runSshOp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('connects with the given credentials, runs the built steps, and closes the session', async () => {
    const close = vi.fn()
    vi.mocked(connect).mockResolvedValue({ close } as never)
    const { win } = fakeWindow()
    const ran = vi.fn()
    await runSshOp(win, 'p1', { host: '10.0.0.5', port: 22, user: 'root', password: 'pw' }, () => [step('go', async () => { ran() })])
    expect(connect).toHaveBeenCalledWith({ host: '10.0.0.5', port: 22, user: 'root', password: 'pw' })
    expect(ran).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('closes the session even when a step fails', async () => {
    const close = vi.fn()
    vi.mocked(connect).mockResolvedValue({ close } as never)
    const { win } = fakeWindow()
    await expect(
      runSshOp(win, 'p1', { host: 'h', port: 22, user: 'u', password: 'p' }, () => [step('boom', async () => { throw new Error('x') })]),
    ).rejects.toThrow('Operation failed')
    expect(close).toHaveBeenCalled()
  })
})
