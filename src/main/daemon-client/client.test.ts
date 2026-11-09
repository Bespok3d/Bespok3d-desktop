// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the node https layer so we can drive the request lifecycle deterministically (no sockets).
vi.mock('https', () => ({
  Agent: class { constructor(_opts: unknown) { void _opts } },
  request: vi.fn(),
}))

import { request as httpsRequest } from 'https'
import {
  fetchDaemonStatus,
  fetchCapabilities,
  recoverPackages,
  DEFAULT_DAEMON_TIMEOUT_MS,
  LONG_OP_TIMEOUT_MS,
} from './client'
import { reportPrinterWork } from './printer-at-work'
import type { PrinterRecord } from '../printers'

interface FakeReq {
  on: (event: string, cb: (arg?: unknown) => void) => void
  setTimeout: (ms: number, cb: () => void) => void
  write: () => void
  end: () => void
  destroy: (err: Error) => void
  armedTimeoutMs?: number
  fireTimeout?: () => void
}

function fakeReq(): FakeReq {
  const handlers: Record<string, (arg?: unknown) => void> = {}
  const req: FakeReq = {
    on: (event, cb) => { handlers[event] = cb },
    setTimeout: (ms, cb) => { req.armedTimeoutMs = ms; req.fireTimeout = cb },
    write: () => {},
    end: () => {},
    destroy: (err) => handlers.error?.(err),
  }

  return req
}

const record = { ip: '127.0.0.1', daemonCert: 'CERT', daemonToken: 'T' } as unknown as PrinterRecord

describe('daemon request timeout', () => {
  beforeEach(() => vi.mocked(httpsRequest).mockReset())

  it('rejects when the daemon holds the connection open but never answers', async () => {
    // The exact hang that froze the update modal: a daemon that keeps the TCP port open but never
    // sends an HTTP response. With a timeout, the request must reject, not wait forever.
    const req = fakeReq()
    vi.mocked(httpsRequest).mockReturnValue(req as never)
    const pending = fetchDaemonStatus(record, 50)
    expect(req.armedTimeoutMs).toBe(50)
    req.fireTimeout?.()
    await expect(pending).rejects.toThrow(/timed out/)
  })

  it('arms the default bound on a quick read when no timeout is requested', () => {
    // Every daemon call must be bounded now: a request with no explicit timeout inherits the default,
    // so a wedged daemon can never hang the UI even on a call whose caller forgot to pass one.
    const req = fakeReq()
    vi.mocked(httpsRequest).mockReturnValue(req as never)
    void fetchDaemonStatus(record).catch(() => undefined)
    expect(req.armedTimeoutMs).toBe(DEFAULT_DAEMON_TIMEOUT_MS)
  })

  it('arms the generous bound on a long op so a real recover/install is not cut off', () => {
    // recover/install/teardown batch work + a service restart before answering; they must use the
    // long timeout, not the short default, or a legitimate long op would be killed mid-flight.
    const req = fakeReq()
    vi.mocked(httpsRequest).mockReturnValue(req as never)
    void recoverPackages(record).catch(() => undefined)
    expect(req.armedTimeoutMs).toBe(LONG_OP_TIMEOUT_MS)
  })

  it('bounds /capabilities too, so the status ping loop cannot hang on a wedged daemon', () => {
    // The ping loop fetches /capabilities every 15s; without a timeout a wedged daemon would stall
    // that printer's status forever. fetchCapabilities must honour the timeout the loop passes.
    const req = fakeReq()
    vi.mocked(httpsRequest).mockReturnValue(req as never)
    const pending = fetchCapabilities(record, 50)
    expect(req.armedTimeoutMs).toBe(50)
    req.fireTimeout?.()

    return expect(pending).rejects.toThrow(/timed out/)
  })
})

describe('a long op while the printer says it is still at work', () => {
  beforeEach(() => vi.mocked(httpsRequest).mockReset())

  const atWorkRecord = { id: 'printer-at-work', ip: '127.0.0.1', daemonCert: 'CERT', daemonToken: 'T' } as unknown as PrinterRecord

  function settledState(pending: Promise<unknown>): { settled: boolean } {
    const state = { settled: false }
    pending.then(() => { state.settled = true }, () => { state.settled = true })

    return state
  }

  it('keeps waiting through the silence, then fails once the printer stops working', async () => {
    // The printer's safety net can run close to ten minutes inside a recovery: the app must not show
    // a failure while the printer is still fixing itself.
    const work = { underWay: true }
    const withdrawReport = reportPrinterWork('printer-at-work', () => work.underWay)
    const req = fakeReq()
    vi.mocked(httpsRequest).mockReturnValue(req as never)
    const pending = recoverPackages(atWorkRecord)
    const state = settledState(pending)

    req.fireTimeout?.()
    // A give-up settles only after the retry path resolves the printer's address: let it run out.
    await new Promise((resolve) => setImmediate(resolve))
    expect(state.settled).toBe(false)
    expect(req.armedTimeoutMs).toBe(LONG_OP_TIMEOUT_MS)

    work.underWay = false
    req.fireTimeout?.()
    withdrawReport()
    await expect(pending).rejects.toThrow(/timed out/)
  })

  it('still fails a quick read fast, whatever the printer reports', async () => {
    const withdrawReport = reportPrinterWork('printer-at-work', () => true)
    const req = fakeReq()
    vi.mocked(httpsRequest).mockReturnValue(req as never)
    const pending = fetchDaemonStatus(atWorkRecord, 50)
    req.fireTimeout?.()
    withdrawReport()
    await expect(pending).rejects.toThrow(/timed out/)
  })
})
