// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrinterRecord } from '../printers'

vi.mock('../daemon-client/client', () => ({ fetchDaemonStatus: vi.fn(), fetchCapabilities: vi.fn() }))

import { assertPrinterMeetsPackageFloors, PackageDoesNotFitPrinter } from './guard'
import { fetchCapabilities, fetchDaemonStatus } from '../daemon-client/client'

const PRINTER = { id: 'printer-1', ip: '203.0.113.7' } as PrinterRecord
const DAEMON_PACKAGE = { name: 'bespok3d-daemon', min_jinni_version: '0.1.10' }

function printerReports(daemonVersion: string, jinniVersion: string): void {
  vi.mocked(fetchDaemonStatus).mockResolvedValue({ version: daemonVersion } as never)
  vi.mocked(fetchCapabilities).mockResolvedValue({ jinni_version: jinniVersion } as never)
}

describe('assertPrinterMeetsPackageFloors', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    printerReports('0.12.22', '0.1.10')
  })

  it('refuses a package whose daemon floor this printer does not reach, naming both versions', async () => {
    printerReports('0.12.19', '0.1.10')

    await expect(assertPrinterMeetsPackageFloors(PRINTER, { name: 'spoolman', min_daemon_version: '0.12.22' }))
      .rejects.toThrow(PackageDoesNotFitPrinter)
    await expect(assertPrinterMeetsPackageFloors(PRINTER, { name: 'spoolman', min_daemon_version: '0.12.22' }))
      .rejects.toThrow(/0\.12\.22.*0\.12\.19/s)
  })

  it('lets a package through when the printer reports a daemon at the floor', async () => {
    printerReports('0.12.22', '0.1.10')

    await expect(assertPrinterMeetsPackageFloors(PRINTER, { name: 'spoolman', min_daemon_version: '0.12.22' }))
      .resolves.toBeUndefined()
  })

  it('never asks the printer for a package that declares no floor', async () => {
    await expect(assertPrinterMeetsPackageFloors(PRINTER, { name: 'idle-timeout' })).resolves.toBeUndefined()
    expect(fetchDaemonStatus).not.toHaveBeenCalled()
    expect(fetchCapabilities).not.toHaveBeenCalled()
  })

  it('does not refuse when the printer will not say what it is running', async () => {
    vi.mocked(fetchDaemonStatus).mockRejectedValue(new Error('daemon restarting'))
    vi.mocked(fetchCapabilities).mockRejectedValue(new Error('daemon restarting'))

    await expect(assertPrinterMeetsPackageFloors(PRINTER, { name: 'spoolman', min_daemon_version: '0.12.22' }))
      .resolves.toBeUndefined()
  })

})

// The daemon's own store card installs through this path. Before the support-package floor was asked
// here, a daemon could be sent to a printer whose support package it would then refuse to drive,
// leaving that printer enrolled and unmanageable.
describe('assertPrinterMeetsPackageFloors on the support package this printer runs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    printerReports('0.12.22', '0.1.10')
  })

  it('refuses a daemon the support package on this printer is too old to be driven by', async () => {
    printerReports('0.12.19', '0.1.9')

    await expect(assertPrinterMeetsPackageFloors(PRINTER, DAEMON_PACKAGE))
      .rejects.toThrow(PackageDoesNotFitPrinter)
    await expect(assertPrinterMeetsPackageFloors(PRINTER, DAEMON_PACKAGE))
      .rejects.toThrow(/support package at 0\.1\.10.*0\.1\.9/s)
  })

  it('lets a daemon through when the support package on this printer meets its floor', async () => {
    printerReports('0.12.19', '0.1.11')

    await expect(assertPrinterMeetsPackageFloors(PRINTER, DAEMON_PACKAGE)).resolves.toBeUndefined()
  })

  it('does not refuse a daemon when the printer does not report a support-package version', async () => {
    vi.mocked(fetchDaemonStatus).mockResolvedValue({ version: '0.12.19' } as never)
    vi.mocked(fetchCapabilities).mockResolvedValue({ jinni_version: 'unknown' } as never)

    await expect(assertPrinterMeetsPackageFloors(PRINTER, DAEMON_PACKAGE)).resolves.toBeUndefined()
  })
})
