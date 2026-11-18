// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment node
import { EventEmitter } from 'events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const sockets: MockSocket[] = []
const openedUrls: string[] = []

class MockSocket extends EventEmitter {
  closed = false
  constructor(url: string) {
    super()
    sockets.push(this)
    openedUrls.push(url)
  }

  close(): void {
    this.closed = true
  }
}

vi.mock('ws', () => ({
  default: vi.fn(function createMockSocket(url: string) {
    return new MockSocket(url)
  }),
}))
vi.mock('../client', () => ({ makeAgent: vi.fn(() => ({})) }))
vi.mock('../../printers', () => ({
  loadPrinters: vi.fn(() => [{ id: 'p1', ip: '192.0.2.1', daemonCert: 'CERT', daemonToken: 'TOK' }]),
}))

import { watchActiveWatch, closeAllActiveWatchWatches } from './active-watch'

afterEach(() => {
  closeAllActiveWatchWatches()
  sockets.length = 0
  openedUrls.length = 0
})

function framesSent(...frames: unknown[]): ReturnType<typeof vi.fn> {
  const send = vi.fn()
  watchActiveWatch('p1', send)
  frames.forEach((frame) => sockets[0].emit('message', typeof frame === 'string' ? frame : JSON.stringify(frame)))

  return send
}

describe('the active-watch feed', () => {
  it('opens the printer feed with its token', () => {
    framesSent()
    expect(openedUrls).toHaveLength(1)
    expect(openedUrls[0]).toMatch(/^wss:\/\/192\.0\.2\.1:\d+\/ws\/active-watch\?token=TOK$/)
  })

  it('passes a notify frame on with its token', () => {
    const send = framesSent({ token: 'screen-stuck', remedy: 'notify' })
    expect(send).toHaveBeenCalledWith({ printerId: 'p1', token: 'screen-stuck', remedy: 'notify' })
  })

  it('passes a reboot frame on with the reboot id', () => {
    const send = framesSent({ token: 'screen-stuck', remedy: 'reboot', id: 'notice-1' })
    expect(send).toHaveBeenCalledWith({ printerId: 'p1', token: 'screen-stuck', remedy: 'reboot', noticeId: 'notice-1' })
  })

  it('passes a notify frame on with the id of the reboot it takes back', () => {
    const send = framesSent({ token: 'screen-stuck', remedy: 'notify', id: 'notice-1' })
    expect(send).toHaveBeenCalledWith({ printerId: 'p1', token: 'screen-stuck', remedy: 'notify', noticeId: 'notice-1' })
  })

  it('drops a frame it cannot read, and a reboot frame with no id', () => {
    const send = framesSent('not json', { token: 'screen-stuck', remedy: 'explode' }, { remedy: 'notify' }, { token: 'screen-stuck', remedy: 'reboot' })
    expect(send).not.toHaveBeenCalled()
  })
})
