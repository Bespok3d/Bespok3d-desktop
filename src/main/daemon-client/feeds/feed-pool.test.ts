// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment node
import { EventEmitter } from 'events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sockets: MockSocket[] = []

class MockSocket extends EventEmitter {
  options: Record<string, unknown>
  constructor(_url: string, options: Record<string, unknown>) {
    super()
    this.options = options
    sockets.push(this)
  }

  close(): void {}
}

vi.mock('ws', () => ({ default: vi.fn((url: string, options: Record<string, unknown>) => new MockSocket(url, options)) }))
vi.mock('../client', () => ({ makeAgent: vi.fn(() => ({})) }))
vi.mock('../../printers', () => ({
  loadPrinters: vi.fn(() => [{ id: 'p1', ip: '10.0.0.1', daemonCert: 'CERT', daemonToken: 'TOK' }]),
}))

import { createFeedPool, MAX_FRAME_BYTES } from './feed-pool'

function watchOneFeed(onMessage: (data: unknown) => void): void {
  createFeedPool().watch('a-feed', 'p1', { endpoint: () => 'wss://printer.example/ws/feed', onMessage })
}

// Everything the printer sends on a live feed arrives inside the socket's own message event, where a
// throw is caught by nobody: it reaches the app as an exception nothing handles and the app goes.
// A printer someone else is driving picks what it sends, so it picks the moment.
describe('what a live feed is allowed to do to the app', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))

  afterEach(() => {
    sockets.length = 0
    vi.restoreAllMocks()
  })

  it('keeps reading the feed after a frame the reader could not deal with', () => {
    const seen: string[] = []
    watchOneFeed((data) => {
      if (String(data) === 'poison') throw new Error('the reader gave up on that frame')
      seen.push(String(data))
    })

    expect(() => sockets[0].emit('message', 'poison')).not.toThrow()
    sockets[0].emit('message', 'a normal frame')
    expect(seen).toEqual(['a normal frame'])
  })

  it('says which printer sent the frame it dropped', () => {
    watchOneFeed(() => { throw new Error('the reader gave up on that frame') })
    sockets[0].emit('message', 'poison')

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('p1'))
  })

  // The daemon sends a token list or one log line. Uncapped, a printer under someone else's control
  // hands this app frames as big as it likes to hold in memory, until the app is killed for holding them.
  it('refuses to hold a frame far larger than anything the daemon sends', () => {
    watchOneFeed(() => {})

    expect(sockets[0].options.maxPayload).toBe(MAX_FRAME_BYTES)
    expect(MAX_FRAME_BYTES).toBeLessThan(1024 * 1024)
  })
})
