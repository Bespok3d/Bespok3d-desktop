// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The real DaemonHttpError is kept: telling an older daemon (404) from a broken one rests on it.
vi.mock('./transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./transport')>()),
  doRequest: vi.fn(),
}))
vi.mock('./status', () => ({ DAEMON_QUERY_TIMEOUT_MS: 8000, getManagedRecord: vi.fn() }))

import { doRequest, DaemonHttpError } from './transport'
import { getManagedRecord } from './status'
import { askPrinterToReach, fetchWebReach } from './web-reach'
import type { PrinterRecord } from '../printers'

const record = { id: 'p1', ip: '10.0.0.5', daemonToken: 'T', daemonCert: 'C' } as unknown as PrinterRecord

const SPOOLMAN = 'https://spoolman.example.org'

function noop() {}

// Block body on purpose: a beforeEach that RETURNS a function registers it as a cleanup hook.
beforeEach(() => {
  vi.mocked(doRequest).mockReset()
  vi.mocked(getManagedRecord).mockReset()
  vi.spyOn(console, 'warn').mockImplementation(noop)
})

describe('fetchWebReach', () => {
  it('posts the address to the printer and hands back the code it answered the printer with', async () => {
    vi.mocked(doRequest).mockResolvedValue(JSON.stringify({ http_code: 404 }))

    expect(await fetchWebReach(record, SPOOLMAN)).toEqual({ asked: true, httpCode: 404 })
    expect(doRequest).toHaveBeenCalledWith(
      record, 'POST', '/net/reach', Buffer.from(JSON.stringify({ url: SPOOLMAN })), 'application/json', undefined,
    )
  })

  it('says nothing answered the printer when the printer got no code', async () => {
    vi.mocked(doRequest).mockResolvedValue(JSON.stringify({ http_code: null }))

    expect(await fetchWebReach(record, SPOOLMAN)).toEqual({ asked: true, httpCode: null })
  })

  it('treats a daemon from before the route as not asked', async () => {
    vi.mocked(doRequest).mockRejectedValue(new DaemonHttpError(404, 'Not Found', 'daemon 404'))

    expect(await fetchWebReach(record, SPOOLMAN)).toEqual({ asked: false })
  })

  it('lets any other daemon error through', async () => {
    vi.mocked(doRequest).mockRejectedValue(new DaemonHttpError(500, 'boom', 'daemon 500'))

    await expect(fetchWebReach(record, SPOOLMAN)).rejects.toThrow(/daemon 500/)
  })
})

describe('askPrinterToReach', () => {
  it('asks the managed printer, within the time a daemon query is given', async () => {
    vi.mocked(getManagedRecord).mockReturnValue(record)
    vi.mocked(doRequest).mockResolvedValue(JSON.stringify({ http_code: 200 }))

    expect(await askPrinterToReach('p1', SPOOLMAN)).toEqual({ asked: true, httpCode: 200 })
    expect(vi.mocked(doRequest).mock.calls[0][5]).toBe(8000)
  })

  it('says not asked, and sends nothing, for a printer that is not managed', async () => {
    vi.mocked(getManagedRecord).mockImplementation(() => { throw new Error('printer not managed') })

    expect(await askPrinterToReach('p1', SPOOLMAN)).toEqual({ asked: false })
    expect(doRequest).not.toHaveBeenCalled()
  })

  it('says not asked when the printer fails to answer', async () => {
    vi.mocked(getManagedRecord).mockReturnValue(record)
    vi.mocked(doRequest).mockRejectedValue(new DaemonHttpError(500, 'boom', 'daemon 500'))

    expect(await askPrinterToReach('p1', SPOOLMAN)).toEqual({ asked: false })
  })
})
