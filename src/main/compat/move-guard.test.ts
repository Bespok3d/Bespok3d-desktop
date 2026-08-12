// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrinterRecord } from '../printers'

vi.mock('../daemon-client/client', () => ({
  fetchDaemonStatus: vi.fn(),
  fetchCapabilities: vi.fn(),
}))
vi.mock('../daemon-client/expected-version', () => ({ expectedDaemonVersion: () => '0.12.23' }))
vi.mock('../daemon-client/feeds/print-state', () => ({ reportedBlockedActions: vi.fn() }))
vi.mock('../printers', () => ({ loadPrinters: vi.fn() }))

import {
  DaemonMoveRefused,
  assertNotADaemonDowngrade,
  assertKnownPrinterNotDowngraded,
  assertPrinterNotPrinting,
  assertPairLandedTogether,
} from './move-guard'
import { fetchDaemonStatus, fetchCapabilities } from '../daemon-client/client'
import { reportedBlockedActions } from '../daemon-client/feeds/print-state'
import { loadPrinters } from '../printers'

// A printer record carrying a jinni version the app wrote down earlier. Every pair test below leaves
// it at a value that would PASS, so a test that fails can only be reading the printer's own answer.
const PRINTER = { id: 'printer-1', ip: '203.0.113.7', jinniVersion: '9.9.9' } as PrinterRecord

function printerReportsDaemon(version: string | undefined): void {
  vi.mocked(fetchDaemonStatus).mockResolvedValue((version === undefined ? undefined : { version }) as never)
}

function printerReportsJinni(jinniVersion: string, minJinniVersion: string): void {
  vi.mocked(fetchCapabilities).mockResolvedValue({ jinni_version: jinniVersion, min_jinni_version: minJinniVersion } as never)
}

function printerSaysItIsBusyWith(blockedActions: string[] | null): void {
  vi.mocked(reportedBlockedActions).mockReturnValue(blockedActions)
}

function readSource(relativePath: string): string {
  return readFileSync(join(__dirname, '..', relativePath), 'utf8')
}

describe('a deploy is always a move forward', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('refuses a printer already running a newer daemon than this app ships, naming both versions', async () => {
    printerReportsDaemon('0.13.0')

    await expect(assertNotADaemonDowngrade(PRINTER)).rejects.toThrow(DaemonMoveRefused)
    await expect(assertNotADaemonDowngrade(PRINTER)).rejects.toThrow(/0\.13\.0.*0\.12\.23/s)
  })

  it('allows the printer that is already on the bundled daemon, and the one behind it', async () => {
    printerReportsDaemon('0.12.23')
    await expect(assertNotADaemonDowngrade(PRINTER)).resolves.toBeUndefined()

    printerReportsDaemon('0.12.19')
    await expect(assertNotADaemonDowngrade(PRINTER)).resolves.toBeUndefined()
  })

  it('allows a printer that answers nothing, so an unreachable daemon never blocks its own repair', async () => {
    vi.mocked(fetchDaemonStatus).mockRejectedValue(new Error('connection refused'))

    await expect(assertNotADaemonDowngrade(PRINTER)).resolves.toBeUndefined()
  })

  it('asks the same question of a printer named by id, and lets a first enrollment through', async () => {
    vi.mocked(loadPrinters).mockReturnValue([])
    await expect(assertKnownPrinterNotDowngraded('printer-never-seen')).resolves.toBeUndefined()
    expect(fetchDaemonStatus).not.toHaveBeenCalled()

    vi.mocked(loadPrinters).mockReturnValue([PRINTER])
    printerReportsDaemon('0.13.0')
    await expect(assertKnownPrinterNotDowngraded('printer-1')).rejects.toThrow(DaemonMoveRefused)
  })

  // The Force menu is the owner saying he wants this app's daemon on the printer whatever it reports
  // running now. It stops being a Force menu the moment this guard still refuses him.
  it('runs anyway when the run was forced, and never even asks the printer its version', async () => {
    printerReportsDaemon('0.13.0')
    await expect(assertNotADaemonDowngrade(PRINTER, true)).resolves.toBeUndefined()

    vi.mocked(loadPrinters).mockReturnValue([PRINTER])
    await expect(assertKnownPrinterNotDowngraded('printer-1', true)).resolves.toBeUndefined()
    expect(fetchDaemonStatus).not.toHaveBeenCalled()
  })
})

describe('a printer that is printing keeps its daemon', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('refuses the move while the printer says it will not accept one', () => {
    printerSaysItIsBusyWith(['plugin_install', 'daemon_restart'])

    expect(() => assertPrinterNotPrinting('printer-1')).toThrow(DaemonMoveRefused)
    expect(() => assertPrinterNotPrinting('printer-1')).toThrow(/printing/)
  })

  it('allows the move when the printer says it is blocking nothing', () => {
    printerSaysItIsBusyWith([])

    expect(() => assertPrinterNotPrinting('printer-1')).not.toThrow()
  })

  it('allows the move when the app was never told, because unknown is not printing', () => {
    printerSaysItIsBusyWith(null)

    expect(() => assertPrinterNotPrinting('printer-1')).not.toThrow()
  })
})

describe('the pair that landed is the pair the printer reports', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('refuses to call the move done when only one half landed', async () => {
    printerReportsDaemon('0.12.23')
    printerReportsJinni('0.1.7', '0.1.10')

    await expect(assertPairLandedTogether(PRINTER)).rejects.toThrow(DaemonMoveRefused)
    await expect(assertPairLandedTogether(PRINTER)).rejects.toThrow(/0\.1\.10.*0\.1\.7/s)
  })

  it('reads the jinni version off the printer and never the one the record holds', async () => {
    printerReportsDaemon('0.12.23')
    printerReportsJinni('0.1.7', '0.1.10')

    await expect(assertPairLandedTogether(PRINTER)).rejects.toThrow(DaemonMoveRefused)
    expect(fetchCapabilities).toHaveBeenCalled()
  })

  it('accepts the pair that fits', async () => {
    printerReportsDaemon('0.12.23')
    printerReportsJinni('0.1.10', '0.1.10')

    await expect(assertPairLandedTogether(PRINTER)).resolves.toBeUndefined()
  })
})

// The guards above are only worth anything where they are called from. These read the sources rather
// than driving a whole SSH operation, and they are what would catch a guard quietly dropped from a
// path: the printer must be asked BEFORE the first byte moves, and the record must be written only
// after the landed pair was read back and accepted.
describe('every path that moves a daemon asks first and records last', () => {
  const daemonOps = readSource('ops/daemon-ops.ts')

  it('asks before the repair and the daemon update touch the printer', () => {
    const repair = daemonOps.slice(daemonOps.indexOf('export async function runRepair'))

    expect(repair.indexOf('assertSafeToMoveDaemon')).toBeLessThan(repair.indexOf('runSshOp'))
    const update = daemonOps.slice(daemonOps.indexOf('export async function runUpdateDaemon'))
    expect(update.indexOf('assertSafeToMoveDaemon')).toBeLessThan(update.indexOf('runSshOp'))
  })

  it('asks before the jinni update restarts the daemon', () => {
    const jinni = daemonOps.slice(daemonOps.indexOf('export async function runUpdateJinni'))

    expect(jinni.indexOf('assertPrinterNotPrinting')).toBeLessThan(jinni.indexOf('runSshOp'))
  })

  it('reads the landed pair back before writing the record, on all three ops', () => {
    const recorded = daemonOps.split('updatePrinter(printerId, { status:')

    expect(recorded).toHaveLength(4)
    recorded.slice(0, 3).forEach((upTo) => {
      expect(upTo).toContain('assertPairLandedTogether')
    })
  })

  // Forcing waives the version question only. A print running on the printer is the user's, so no menu
  // of ours gets to ruin it, and the Update menu is not a Force flow and keeps the question.
  it('carries the forced flag into the version question and nowhere near the running-print one', () => {
    const safeToMove = daemonOps.slice(daemonOps.indexOf('async function assertSafeToMoveDaemon'), daemonOps.indexOf('export async function'))

    expect(safeToMove).toContain('assertPrinterNotPrinting(record.id)')
    expect(safeToMove).toContain('assertNotADaemonDowngrade(record, forced)')
    const update = daemonOps.slice(daemonOps.indexOf('export async function runUpdateDaemon'))
    expect(update).toContain('assertSafeToMoveDaemon(record, false)')
  })

  it('asks before recovery after a firmware update re-enrolls a printer the app already knows', () => {
    const enrollment = readSource('enrollment.ts')
    const enroll = enrollment.slice(enrollment.indexOf('export async function enrollPrinter'))

    expect(enroll.indexOf('assertKnownPrinterNotDowngraded')).toBeLessThan(enroll.indexOf('adapter.enrollSteps'))
  })
})
