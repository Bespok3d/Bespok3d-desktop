// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./transport', () => ({ doRequest: vi.fn(), LONG_OP_TIMEOUT_MS: 1 }))

import { doRequest } from './transport'
import { fetchFileHashesOrNone, restoreFiles } from './plugin-files-client'
import type { PrinterRecord } from '../printers'

const PRINTER = { ip: '203.0.113.7', daemonCert: 'C', daemonToken: 'T' } as unknown as PrinterRecord
const SIGNED_SHA = 'a'.repeat(64)

describe('reading what the printer holds of a plugin', () => {
  beforeEach(() => vi.mocked(doRequest).mockReset())

  it('answers each listed file with the hash the printer read', async () => {
    vi.mocked(doRequest).mockResolvedValue(JSON.stringify({ files: { 'files/camera.sh': SIGNED_SHA, 'files/gone.sh': null } }))
    expect(await fetchFileHashesOrNone(PRINTER, 'example-camera')).toEqual({ 'files/camera.sh': SIGNED_SHA, 'files/gone.sh': null })
    expect(vi.mocked(doRequest).mock.calls[0].slice(1, 3)).toEqual(['GET', '/plugins/example-camera/file-hashes'])
  })

  it('answers "not known" when a daemon too old for the route refuses it', async () => {
    vi.mocked(doRequest).mockRejectedValueOnce(new Error('HTTP 404'))
    expect(await fetchFileHashesOrNone(PRINTER, 'example-camera')).toBeNull()
  })
})

describe('putting back the files that changed', () => {
  beforeEach(() => vi.mocked(doRequest).mockReset())

  it('posts the archive as a multipart upload and answers what the printer restored', async () => {
    vi.mocked(doRequest).mockResolvedValue(JSON.stringify({ restored: ['files/camera.sh'] }))
    expect(await restoreFiles(PRINTER, 'example-camera', Buffer.from('zip bytes'))).toEqual(['files/camera.sh'])
    const [, method, path, body, contentType] = vi.mocked(doRequest).mock.calls[0]
    expect([method, path]).toEqual(['POST', '/plugins/example-camera/restore-files'])
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/)
    expect((body as Buffer).includes(Buffer.from('zip bytes'))).toBe(true)
  })
})
