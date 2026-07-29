// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Drive the route choice without a socket: the batch posters differ only in the path they POST to, and
// that path is the Bug A app-side fix (install-selected must hit install-batch, not update-batch).
vi.mock('./transport', () => ({
  doRequest: vi.fn().mockResolvedValue(JSON.stringify({ ok: true, results: [] })),
  LONG_OP_TIMEOUT_MS: 1,
}))

import { doRequest } from './transport'
import { installBatchPackages, updateBatchPackages } from './packages-client'
import type { PrinterRecord } from '../printers'

const record = { ip: '127.0.0.1', daemonCert: 'C', daemonToken: 'T' } as unknown as PrinterRecord
const packages = [{ pluginId: 'camera', bytes: Buffer.from('x') }]

function postedPath(): string {
  return vi.mocked(doRequest).mock.calls[0][2]
}

describe('batch package routes', () => {
  beforeEach(() => vi.mocked(doRequest).mockClear())

  it('routes install-selected to the install-batch route (one deferred restart, conflict-checked)', async () => {
    await installBatchPackages(record, packages)
    expect(postedPath()).toBe('/packages/install-batch')
  })

  it('routes update-all to the update-batch route', async () => {
    await updateBatchPackages(record, packages)
    expect(postedPath()).toBe('/packages/update-batch')
  })
})
