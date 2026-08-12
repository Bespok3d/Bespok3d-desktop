// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment node
import { EventEmitter } from 'events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const sockets: MockSocket[] = []

class MockSocket extends EventEmitter {
  closed = false
  constructor() {
    super()
    sockets.push(this)
  }

  close(): void {
    this.closed = true
  }
}

vi.mock('ws', () => ({ default: vi.fn(() => new MockSocket()) }))
vi.mock('../client', () => ({ makeAgent: vi.fn(() => ({})) }))

import { watchInstallProgress, parseEvent, batchEventFrom, installPhaseMessage } from './install-progress'
import type { InstallLogPhase } from '@bespok3d/contract'

afterEach(() => {
  sockets.length = 0
  vi.clearAllMocks()
})

function okPhase(id: string, label: string): InstallLogPhase {
  return { id, label, ok: true, items: [] }
}

describe('parseEvent', () => {
  it('parses a phase event', () => {
    const phase = okPhase('extract', 'Unpack')
    const data = Buffer.from(JSON.stringify({ type: 'phase', phase }))
    expect(parseEvent(data)).toEqual({ type: 'phase', phase })
  })

  it('parses a done event with ok and error', () => {
    const data = Buffer.from(JSON.stringify({ type: 'done', ok: false, error: 'boom' }))
    expect(parseEvent(data)).toEqual({ type: 'done', ok: false, error: 'boom' })
  })

  it('returns null for an unknown shape or malformed JSON', () => {
    expect(parseEvent(Buffer.from('{"type":"noise"}'))).toBeNull()
    expect(parseEvent(Buffer.from('not json'))).toBeNull()
  })
})

describe('installPhaseMessage', () => {
  it('uses the phase label when the phase is ok', () => {
    expect(installPhaseMessage(okPhase('symlinks', 'Symlinks'))).toBe('Symlinks')
  })

  it('surfaces the failing item output on a failed phase', () => {
    const phase: InstallLogPhase = {
      id: 'start', label: 'Start', ok: false,
      items: [{ label: 'restart klipper', ok: false, output: 'klipper did not come back' }],
    }
    expect(installPhaseMessage(phase)).toBe('Start failed: klipper did not come back')
  })
})

describe('watchInstallProgress', () => {
  it('resolves immediately with a no-op close when the printer has no cert/token', async () => {
    const close = await watchInstallProgress({ ip: '10.0.0.1' }, vi.fn())
    expect(sockets).toHaveLength(0)
    expect(() => close()).not.toThrow()
  })

  it('forwards phase events once the socket is open', async () => {
    const onEvent = vi.fn()
    const ready = watchInstallProgress({ ip: '10.0.0.1', daemonCert: 'C', daemonToken: 'T' }, onEvent)
    sockets[0].emit('open')
    await ready
    const phase = okPhase('dirs', 'Dirs')
    sockets[0].emit('message', Buffer.from(JSON.stringify({ type: 'phase', phase })))
    expect(onEvent).toHaveBeenCalledWith({ type: 'phase', phase })
  })

  it('degrades to a no-op close on a socket error (old daemon without the route)', async () => {
    const close = watchInstallProgress({ ip: '10.0.0.1', daemonCert: 'C', daemonToken: 'T' }, vi.fn())
    sockets[0].emit('error', new Error('no route'))
    await expect(close).resolves.toBeTypeOf('function')
    expect(sockets[0].closed).toBe(true)
  })
})

describe('a recovery plan announced by the printer', () => {
  it('reaches the renderer as the plan its rows are drawn from', () => {
    const data = Buffer.from(JSON.stringify({ type: 'plan', ids: ['rfid-ntag', 'spoolman'] }))
    const parsed = parseEvent(data)

    expect(parsed).toEqual({ type: 'plan', ids: ['rfid-ntag', 'spoolman'] })
    expect(batchEventFrom(parsed!)).toEqual({ type: 'plan', ids: ['rfid-ntag', 'spoolman'] })
  })
})
