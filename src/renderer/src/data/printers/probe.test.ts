// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { pingAndUpdate } from './probe'
import { makePrinter } from '../../test/fixtures'
import type { Printer } from '../types'

afterEach(() => { vi.unstubAllGlobals() })

function stubDaemonAnswer(answer: Record<string, unknown>): void {
  vi.stubGlobal('b3d', { printers: { checkDaemon: vi.fn().mockResolvedValue(answer), checkWriteLayer: vi.fn() } })
}

async function statusAfterPing(printer: Printer, answer: Record<string, unknown>): Promise<Printer['status']> {
  var seen: Printer[] = [printer]
  stubDaemonAnswer(answer)
  await pingAndUpdate(printer, (update) => { seen = update(seen) })

  return seen[0].status
}

describe('a ping never puts a switched-off printer back to looking healthy', () => {
  it('shows the printer as deactivated while the printer itself says bespok3d is switched off', async () => {
    const status = await statusAfterPing(makePrinter(), { isManaged: true, reach: 'managed', sshOpen: true, switchedOff: true })
    expect(status).toBe('deactivated')
  })

  it('shows a printer that is switched on as managed again, without waiting for a reactivate', async () => {
    const wasOff = makePrinter({ status: 'deactivated' })
    const status = await statusAfterPing(wasOff, { isManaged: true, reach: 'managed', sshOpen: true, switchedOff: false })
    expect(status).toBe('managed')
  })

  it('reads a daemon too old to answer the question as switched on', async () => {
    const status = await statusAfterPing(makePrinter(), { isManaged: true, reach: 'managed', sshOpen: true })
    expect(status).toBe('managed')
  })
})

// Switching bespok3d off removes the boot hook, so the restart that follows leaves no daemon to answer.
// Reading that silence as a broken daemon offered Repair, Recover and a version update on a printer the
// user had just switched off.
describe('a switched-off printer with no daemon left to answer', () => {
  it('stays switched off instead of looking like a printer whose daemon broke', async () => {
    const switchedOff = makePrinter({ status: 'deactivated', deactivated: true })
    const status = await statusAfterPing(switchedOff, { isManaged: false, reach: 'recoverable', sshOpen: true })
    expect(status).toBe('deactivated')
  })

  it('says offline when the printer answers on nothing at all', async () => {
    const switchedOff = makePrinter({ status: 'deactivated', deactivated: true })
    const status = await statusAfterPing(switchedOff, { isManaged: false, reach: 'offline', sshOpen: false })
    expect(status).toBe('offline')
  })

  it('clears the switched-off note the moment the printer says bespok3d is back on', async () => {
    var seen: Printer[] = [makePrinter({ status: 'deactivated', deactivated: true })]
    stubDaemonAnswer({ isManaged: true, reach: 'managed', sshOpen: true, switchedOff: false })
    await pingAndUpdate(seen[0], (update) => { seen = update(seen) })
    expect(seen[0].deactivated).toBe(false)
  })
})
