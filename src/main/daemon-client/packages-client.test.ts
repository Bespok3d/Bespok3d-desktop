// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Drive the route choice without a socket: the batch posters differ only in the path they POST to, and
// that path is the Bug A app-side fix (install-selected must hit install-batch, not update-batch).
vi.mock('./transport', () => ({
  doRequest: vi.fn().mockResolvedValue(JSON.stringify({ ok: true, results: [] })),
  LONG_OP_TIMEOUT_MS: 1,
  DaemonHttpError: class DaemonHttpError extends Error {
    statusCode: number
    detail: unknown
    constructor(statusCode: number, detail: unknown, message: string) {
      super(message)
      this.statusCode = statusCode
      this.detail = detail
    }
  },
}))

import { DaemonHttpError, doRequest } from './transport'
import { installBatchPackages, recoverAfterReboot, recoverPackages, repairOrRecover, updateBatchPackages } from './packages-client'
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

function postedPaths(): string[] {
  return vi.mocked(doRequest).mock.calls.map((call) => call[2])
}

function postedBody(callIndex: number): unknown {
  const body = vi.mocked(doRequest).mock.calls[callIndex][3] as Buffer | undefined

  return body ? JSON.parse(body.toString()) : undefined
}

// Bespok3d-desktop#30: a printer that only lost its include lines was getting every plugin put back,
// with its services restarted one by one and then the printer rebooted on top.
describe('repairing a printer after an OTA', () => {
  beforeEach(() => vi.mocked(doRequest).mockReset().mockResolvedValue(JSON.stringify({ ok: true, results: [] })))

  it('asks for the setup repair first, and stops there when the printer takes it', async () => {
    await repairOrRecover(record, true)

    expect(postedPaths()).toEqual(['/packages/repair-setup'])
  })

  it('puts every plugin back only when the printer says the setup repair is not enough', async () => {
    vi.mocked(doRequest).mockRejectedValueOnce(new DaemonHttpError(409, { error: 'needs_recover' }, 'conflict'))

    await repairOrRecover(record, true)

    expect(postedPaths()).toEqual(['/packages/repair-setup', '/packages/recover'])
    expect(postedBody(1)).toEqual({ reboot_follows: true })
  })

  it('does not fall back to the full recover on any other refusal', async () => {
    vi.mocked(doRequest).mockRejectedValueOnce(new DaemonHttpError(409, { error: 'printing' }, 'conflict'))

    await expect(repairOrRecover(record, true)).rejects.toThrow('conflict')
    expect(postedPaths()).toEqual(['/packages/repair-setup'])
  })

  it('tells the printer nothing about a reboot when no reboot follows, so it keeps its services restart', async () => {
    await recoverPackages(record)

    expect(postedBody(0)).toBeUndefined()
  })

  it('gives both calls the long time limit, so neither waits forever', async () => {
    vi.mocked(doRequest).mockRejectedValueOnce(new DaemonHttpError(409, { error: 'needs_recover' }, 'conflict'))

    await repairOrRecover(record, false)

    expect(vi.mocked(doRequest).mock.calls.map((call) => call[5])).toEqual([1, 1])
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

// daemon 0.14.3: once the printer is back from the reboot a recover left its services restart to, the
// app asks for the check that restart would have had.
describe('the check after the reboot', () => {
  // A block body: a hook that returns a function has vitest run it as the teardown, and the mock left
  // refusing would then fail the test after it passed.
  beforeEach(() => {
    vi.mocked(doRequest).mockReset().mockResolvedValue(JSON.stringify({ ok: true, results: [] }))
  })
  afterEach(() => vi.useRealTimers())

  it('is asked of the printer with the same time limit as the recover', async () => {
    await recoverAfterReboot(record)

    expect(postedPaths()).toEqual(['/packages/recover/after-reboot'])
    expect(vi.mocked(doRequest).mock.calls[0][5]).toBe(1)
  })

  it('is asked again later when the printer is printing or its services are still coming up', async () => {
    vi.useFakeTimers()
    vi.mocked(doRequest)
      .mockRejectedValueOnce(new DaemonHttpError(409, { error: 'blocked' }, 'blocked'))
      .mockRejectedValueOnce(new DaemonHttpError(422, 'no reply', 'fault'))
      .mockResolvedValueOnce(JSON.stringify({ ok: false, results: [{ plugin_id: '(services)', ok: false, skipped: false, reason: '', log: [], auto_deactivated: 'spoolman' }] }))

    const check = recoverAfterReboot(record)
    await vi.runAllTimersAsync()

    expect((await check).results[0].autoDeactivated).toBe('spoolman')
    expect(postedPaths()).toHaveLength(3)
  })

  it('gives up after a few refusals, so the report is not held for ever', async () => {
    vi.useFakeTimers()
    vi.mocked(doRequest).mockRejectedValue(new DaemonHttpError(409, { error: 'blocked' }, 'blocked'))

    const check = recoverAfterReboot(record)
    const refused = expect(check).rejects.toThrow('blocked')
    await vi.runAllTimersAsync()

    await refused
    expect(postedPaths()).toHaveLength(4)
  })

  it('is not asked again for any other failure', async () => {
    vi.mocked(doRequest).mockRejectedValueOnce(new DaemonHttpError(404, null, 'not found'))

    await expect(recoverAfterReboot(record)).rejects.toThrow('not found')
    expect(postedPaths()).toHaveLength(1)
  })
})
