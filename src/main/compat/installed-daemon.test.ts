// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect, vi } from 'vitest'
import type { SshSession } from '../ssh'

vi.mock('../daemon-client/expected-version', () => ({ shippedDaemonVersion: () => '0.14.0' }))

import { installedDaemonVersion, keepingNewerInstalledDaemon } from './installed-daemon'

const PRINTER_BESPOK3D_ROOT = '/opt/bespok3d-example'
const DAEMON_VERSION_SOURCE = fileURLToPath(new URL('../../../../daemon/version.py', import.meta.url))

function printerWhoseVersionFileSays(versionFileText: string): SshSession {
  return { exec: vi.fn().mockResolvedValue(versionFileText) } as unknown as SshSession
}

describe('the daemon the printer has on its disk', () => {
  it('is the version its version file names', async () => {
    var printer = printerWhoseVersionFileSays('# header\nDAEMON_VERSION = "0.14.1"\nMIN_JINNI_VERSION = "0.1.10"\n')

    await expect(installedDaemonVersion(printer, PRINTER_BESPOK3D_ROOT)).resolves.toBe('0.14.1')
  })

  it('is read under the bespok3d folder the printer\'s adapter names', async () => {
    var printer = printerWhoseVersionFileSays('')

    await installedDaemonVersion(printer, PRINTER_BESPOK3D_ROOT)

    expect(printer.exec).toHaveBeenCalledWith(expect.stringContaining('/opt/bespok3d-example/var/lib/daemon/version.py'))
  })

  it('is none when the printer has no daemon files', async () => {
    await expect(installedDaemonVersion(printerWhoseVersionFileSays(''), PRINTER_BESPOK3D_ROOT)).resolves.toBeNull()
  })

  it.skipIf(!existsSync(DAEMON_VERSION_SOURCE))('is still read from the version file the daemon ships', async () => {
    var printer = printerWhoseVersionFileSays(readFileSync(DAEMON_VERSION_SOURCE, 'utf-8'))

    await expect(installedDaemonVersion(printer, PRINTER_BESPOK3D_ROOT)).resolves.toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('an enrollment step', () => {
  it('is left as the adapter wrote it unless it deploys the daemon', () => {
    var startStep = { id: 'start-daemon', label: 'Start', detail: '', run: vi.fn() }

    expect(keepingNewerInstalledDaemon(startStep, PRINTER_BESPOK3D_ROOT)).toBe(startStep)
  })
})
