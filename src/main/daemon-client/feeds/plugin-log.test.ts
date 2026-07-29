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
vi.mock('../../printers', () => ({
  loadPrinters: vi.fn(() => [{ id: 'p1', ip: '10.0.0.1', daemonCert: 'CERT', daemonToken: 'TOK' }]),
}))

import { watchPluginLog, unwatchPluginLog, closeAllPluginLogWatches } from './plugin-log'

afterEach(() => {
  closeAllPluginLogWatches()
  sockets.length = 0
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('plugin-log watching', () => {
  it('opens one socket per printer+plugin and reuses it while refs remain', () => {
    const send = vi.fn()
    watchPluginLog('p1', 'octoeverywhere', send)
    watchPluginLog('p1', 'octoeverywhere', send)
    expect(sockets).toHaveLength(1)

    unwatchPluginLog('p1', 'octoeverywhere')
    expect(sockets[0].closed).toBe(false) // still one ref

    unwatchPluginLog('p1', 'octoeverywhere')
    expect(sockets[0].closed).toBe(true) // last ref dropped
  })

  it('keys watches by plugin, not just printer', () => {
    watchPluginLog('p1', 'octoeverywhere', vi.fn())
    watchPluginLog('p1', 'spoolman', vi.fn())
    expect(sockets).toHaveLength(2)
  })

  it('relays a parsed match and ignores garbage frames', () => {
    const send = vi.fn()
    watchPluginLog('p1', 'octoeverywhere', send)
    sockets[0].emit('message', Buffer.from(JSON.stringify({ value: 'https://oe.example/x', pattern: 'url' })))
    sockets[0].emit('message', Buffer.from('not json'))
    sockets[0].emit('message', Buffer.from(JSON.stringify({ value: '' })))
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({
      printerId: 'p1',
      pluginId: 'octoeverywhere',
      value: 'https://oe.example/x',
      pattern: 'url',
    })
  })

  it('after teardown, a late close does not reconnect', () => {
    vi.useFakeTimers()
    watchPluginLog('p1', 'octoeverywhere', vi.fn())
    const socket = sockets[0]
    closeAllPluginLogWatches()
    socket.emit('close')
    vi.advanceTimersByTime(3000)
    expect(sockets).toHaveLength(1)
  })
})
