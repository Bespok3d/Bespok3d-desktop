// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect, vi } from 'vitest'
import type { SshSession } from '../ssh'
import type { EnrollContext } from '../adapter-loader'

vi.mock('../store/system-package', () => ({ openSystemPackage: vi.fn() }))
vi.mock('./kept-daemon', () => ({ refreshKeptDaemon: vi.fn() }))

import { installedDaemonVersion, keepingNewerInstalledDaemon } from './installed-daemon'
import { openSystemPackage } from '../store/system-package'
import type { BundledPackage } from '../store/bundled-package'
import { refreshKeptDaemon } from './kept-daemon'
import type { AdapterDefinition } from '../adapter-loader'

const PRINTER_BESPOK3D_ROOT = '/opt/bespok3d-example'
const ENROLLING_PRINTER: EnrollContext = {
  printerId: 'printer-1', ip: '192.0.2.10', credentials: { port: 22, user: 'root', password: 'example' }, runtimeUser: 'user',
}
const PRINTER_ADAPTER = { envVars: [{ name: 'BESPOK3D', value: PRINTER_BESPOK3D_ROOT }] } as unknown as AdapterDefinition
const DAEMON_VERSION_SOURCE = fileURLToPath(new URL('../../../../daemon/version.py', import.meta.url))

function printerWhoseVersionFileSays(versionFileText: string): SshSession {
  return { exec: vi.fn().mockResolvedValue(versionFileText) } as unknown as SshSession
}

describe('the daemon the printer has on its disk', () => {
  it('is the version its version file names', async () => {
    var printer = printerWhoseVersionFileSays('# header\nDAEMON_VERSION = "0.14.1"\nMIN_JINNI_VERSION = "0.1.10"\n')

    await expect(installedDaemonVersion(printer, PRINTER_BESPOK3D_ROOT)).resolves.toBe('0.14.1')
  })

  it('is read under the bespok3d folder the printer\'s adapter names, quoted for the shell', async () => {
    var printer = printerWhoseVersionFileSays('')

    await installedDaemonVersion(printer, PRINTER_BESPOK3D_ROOT)

    expect(printer.exec).toHaveBeenCalledWith(expect.stringContaining("'/opt/bespok3d-example/var/lib/daemon/version.py'"))
  })

  it('is read past a trailing comment, single quotes and a Windows line end', async () => {
    var printer = printerWhoseVersionFileSays("DAEMON_VERSION = '0.14.1'  # released\r\n")

    await expect(installedDaemonVersion(printer, PRINTER_BESPOK3D_ROOT)).resolves.toBe('0.14.1')
  })

  it('is none when the printer has no daemon files', async () => {
    await expect(installedDaemonVersion(printerWhoseVersionFileSays(''), PRINTER_BESPOK3D_ROOT)).resolves.toBeNull()
  })

  it.skipIf(!existsSync(DAEMON_VERSION_SOURCE))('is still read from the version file the daemon ships', async () => {
    var printer = printerWhoseVersionFileSays(readFileSync(DAEMON_VERSION_SOURCE, 'utf-8'))

    await expect(installedDaemonVersion(printer, PRINTER_BESPOK3D_ROOT)).resolves.toMatch(/^\d+\.\d+\.\d+/)
  })
})

function deployLands(deployingVersion: string): void {
  vi.mocked(openSystemPackage).mockResolvedValue({ version: deployingVersion } as BundledPackage)
}

async function runDeployOn(installedVersionFileText: string, onProgress = vi.fn()): Promise<ReturnType<typeof vi.fn>> {
  var deployRun = vi.fn()
  var deployStep = keepingNewerInstalledDaemon({ id: 'deploy-daemon', label: 'Deploy', detail: '', run: deployRun }, PRINTER_ADAPTER)

  await deployStep.run(printerWhoseVersionFileSays(installedVersionFileText), { ...ENROLLING_PRINTER, onProgress })

  return deployRun
}

describe('the daemon deploy of an enrollment', () => {
  it('keeps a daemon newer than the one it would land, which is this app\'s own copy when the download fails', async () => {
    var onProgress = vi.fn()
    deployLands('0.14.0')

    expect(await runDeployOn('DAEMON_VERSION = "0.14.1"\n', onProgress)).not.toHaveBeenCalled()
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('0.14.1'))
  })

  it('still brings the jinni and the packages of the daemon it keeps up to date', async () => {
    vi.mocked(refreshKeptDaemon).mockClear()
    deployLands('0.14.0')

    await runDeployOn('DAEMON_VERSION = "0.14.1"\n')

    expect(refreshKeptDaemon).toHaveBeenCalledWith(PRINTER_ADAPTER, expect.anything(), expect.anything())
  })

  it('reads the daemon on the disk under the bespok3d folder the printer\'s adapter names', async () => {
    var printer = printerWhoseVersionFileSays('')

    await keepingNewerInstalledDaemon({ id: 'deploy-daemon', label: 'Deploy', detail: '', run: vi.fn() }, PRINTER_ADAPTER).run(printer, ENROLLING_PRINTER)

    expect(printer.exec).toHaveBeenCalledWith(expect.stringContaining("'/opt/bespok3d-example/var/lib/daemon/version.py'"))
  })

  it('deploys on a printer with no daemon without opening the package first', async () => {
    vi.mocked(openSystemPackage).mockClear()

    expect(await runDeployOn('')).toHaveBeenCalledOnce()
    expect(openSystemPackage).not.toHaveBeenCalled()
  })

  it('moves the printer forward when the daemon it would land is newer', async () => {
    deployLands('0.15.0')

    expect(await runDeployOn('DAEMON_VERSION = "0.14.1"\n')).toHaveBeenCalledOnce()
  })

  it('finishes a deploy of that same daemon that was cut short, and brings nothing else up', async () => {
    vi.mocked(refreshKeptDaemon).mockClear()
    deployLands('0.15.0')

    expect(await runDeployOn('DAEMON_VERSION = "0.15.0"\n')).toHaveBeenCalledOnce()
    expect(refreshKeptDaemon).not.toHaveBeenCalled()
  })
})

describe('an enrollment step', () => {
  it('is left as the adapter wrote it unless it deploys the daemon', () => {
    var startStep = { id: 'start-daemon', label: 'Start', detail: '', run: vi.fn() }

    expect(keepingNewerInstalledDaemon(startStep, PRINTER_ADAPTER)).toBe(startStep)
  })
})
