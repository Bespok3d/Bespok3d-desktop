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

// R-TORN-2: the printer reports the plugins whose own manifest it could not read alongside the batch it
// ran. It is read off that same answer, in the same parse, or nothing downstream can tell the user which
// plugin the printer cannot account for.
describe('what the printer says about plugins it could not read', () => {
  beforeEach(() => vi.mocked(doRequest).mockClear())

  const oneUnreadablePlugin = { plugin: 'rfid-ntag', problem: 'manifest-unreadable', detail: 'manifest.json: Expecting value: line 1 column 1' }

  it('carries what the printer reported off the batch answer', async () => {
    vi.mocked(doRequest).mockResolvedValueOnce(JSON.stringify({ ok: true, results: [], manifest_warnings: [oneUnreadablePlugin] }))
    const batch = await updateBatchPackages(record, packages)

    expect(batch.manifestWarnings).toEqual([oneUnreadablePlugin])
  })

  // Every daemon in the field today answers without the field. That is the ordinary answer, not a fault.
  it('reads an answer that does not mention it as nothing to report', async () => {
    const batch = await updateBatchPackages(record, packages)

    expect(batch.manifestWarnings).toBeUndefined()
    expect(batch.ok).toBe(true)
  })

  it('drops an entry it could not show rather than putting a broken row in front of the user', async () => {
    const halfAnEntry = { plugin: 'camera' }
    vi.mocked(doRequest).mockResolvedValueOnce(JSON.stringify({ ok: true, results: [], manifest_warnings: [halfAnEntry, 'not an entry at all', oneUnreadablePlugin] }))
    const batch = await updateBatchPackages(record, packages)

    expect(batch.manifestWarnings?.map((warning) => warning.plugin)).toEqual(['rfid-ntag'])
  })
})
