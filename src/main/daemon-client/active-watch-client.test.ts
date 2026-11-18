// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./transport')>()),
  doRequest: vi.fn(),
}))

import { doRequest, DaemonHttpError } from './transport'
import { fetchActiveWatchSetting, saveActiveWatchSetting } from './active-watch-client'
import type { PrinterRecord } from '../printers'

const PRINTER = { ip: '203.0.113.7', daemonCert: 'C', daemonToken: 'T' } as unknown as PrinterRecord
const SETTING = { enabled: true, files: ['/dev/kmsg'], remedies: { 'screen-stuck': 'notify' as const } }
const NOT_FOUND = new DaemonHttpError(404, 'Not Found', 'HTTP 404')

describe('the active-watch setting', () => {
  beforeEach(() => {
    vi.mocked(doRequest).mockReset()
  })

  it('reads the setting', async () => {
    vi.mocked(doRequest).mockResolvedValue(JSON.stringify(SETTING))
    expect(await fetchActiveWatchSetting(PRINTER)).toEqual(SETTING)
    expect(vi.mocked(doRequest).mock.calls[0].slice(1, 3)).toEqual(['GET', '/active-watch'])
  })

  it('reads no setting from a daemon too old to have the watch', async () => {
    vi.mocked(doRequest).mockRejectedValue(NOT_FOUND)
    expect(await fetchActiveWatchSetting(PRINTER)).toBeNull()
  })

  it('passes on any other failure', async () => {
    vi.mocked(doRequest).mockRejectedValue(new DaemonHttpError(500, 'boom', 'HTTP 500'))
    await expect(fetchActiveWatchSetting(PRINTER)).rejects.toThrow('HTTP 500')
  })

  it('saves the setting as JSON and answers what the printer saved', async () => {
    vi.mocked(doRequest).mockResolvedValue(JSON.stringify(SETTING))
    expect(await saveActiveWatchSetting(PRINTER, SETTING)).toEqual(SETTING)
    const [, method, path, body, contentType] = vi.mocked(doRequest).mock.calls[0]
    expect([method, path, contentType]).toEqual(['PUT', '/active-watch', 'application/json'])
    expect(JSON.parse((body as Buffer).toString())).toEqual(SETTING)
  })
})
