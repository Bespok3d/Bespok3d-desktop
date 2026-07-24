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

import { watchPrintState, closeAllPrintStateWatches } from './print-state'

afterEach(() => {
  closeAllPrintStateWatches()
  sockets.length = 0
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('print-state reconnect', () => {
  it('relays a blocked-actions frame as the token set, stamped with a timestamp', () => {
    const send = vi.fn()
    watchPrintState('p1', send)
    sockets[0].emit('message', JSON.stringify({ blocked_actions: ['restart-klipper', 'restart-display'] }))
    expect(send).toHaveBeenCalledWith({
      printerId: 'p1', blockedActions: ['restart-klipper', 'restart-display'], at: expect.any(Number),
    })
  })

  it('on a live socket close, unlocks the UI (empty token set) and re-arms a reconnect', () => {
    vi.useFakeTimers()
    const send = vi.fn()
    watchPrintState('p1', send)
    expect(sockets).toHaveLength(1)

    sockets[0].emit('close')
    expect(send).toHaveBeenCalledWith({ printerId: 'p1', blockedActions: [], at: expect.any(Number) })

    vi.advanceTimersByTime(3000)
    expect(sockets).toHaveLength(2) // reconnected
  })

  it('after teardown, a late close does not send (no push to a destroyed window) or reconnect', () => {
    vi.useFakeTimers()
    const send = vi.fn()
    watchPrintState('p1', send)
    const socket = sockets[0]

    closeAllPrintStateWatches()
    socket.emit('close') // a close event arriving after the window/app tore the watch down

    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(sockets).toHaveLength(1) // no reconnect
  })
})
