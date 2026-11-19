// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdapterDefinition, EnrollContext, EnrollStep } from '../adapter-loader'
import type { SshSession } from '../ssh'

vi.mock('./jinni-baseline', () => ({ offeredJinniBuild: vi.fn() }))

import { installedJinniFingerprint, installedJinniVersion, refreshKeptDaemon } from './kept-daemon'
import { offeredJinniBuild } from './jinni-baseline'

const PRINTER_BESPOK3D_ROOT = '/opt/bespok3d-example'
const KEEPING_PRINTER: EnrollContext = {
  printerId: 'printer-1', ip: '192.0.2.10', credentials: { port: 22, user: 'root', password: 'example' }, runtimeUser: 'user',
}

const OFFERED_JINNI_FINGERPRINT = 'ab'.repeat(32)
const OTHER_JINNI_FINGERPRINT = 'cd'.repeat(32)

function printerWhoseJinniFileSays(versionFileText: string, keptManifestText = ''): SshSession {
  function catOf(command: string): string {
    return command.includes('/manifests/') ? keptManifestText : versionFileText
  }

  return { exec: vi.fn(async (command: string) => catOf(command)) } as unknown as SshSession
}

function keptManifestWith(fingerprint: string): string {
  return JSON.stringify({ name: 'bespok3d-jinni-example', version: '0.1.12', fingerprint })
}

function adapterStep(id: string): EnrollStep {
  return { id, label: id, detail: '', run: vi.fn() }
}

function adapterWith(opSteps: EnrollStep[]): AdapterDefinition {
  return {
    jinniVersion: '0.1.9', jinniPackage: 'bespok3d-jinni-example', enrollSteps: [], opSteps,
    envVars: [{ name: 'BESPOK3D', value: PRINTER_BESPOK3D_ROOT }],
  } as unknown as AdapterDefinition
}

beforeEach(() => {
  vi.mocked(offeredJinniBuild).mockReturnValue({ version: '0.1.12', fingerprint: OFFERED_JINNI_FINGERPRINT })
})

describe('the jinni the printer has on its disk', () => {
  it('is the version its version file names, read under the bespok3d folder the adapter names', async () => {
    var printer = printerWhoseJinniFileSays('{\n  "jinni_version": "0.1.12"\n}\n')

    await expect(installedJinniVersion(printer, PRINTER_BESPOK3D_ROOT)).resolves.toBe('0.1.12')
    expect(printer.exec).toHaveBeenCalledWith(expect.stringContaining('/opt/bespok3d-example/var/lib/daemon/version.json'))
  })

  it('is none when the printer has no jinni files', async () => {
    await expect(installedJinniVersion(printerWhoseJinniFileSays(''), PRINTER_BESPOK3D_ROOT)).resolves.toBeNull()
  })

  it('carries the fingerprint its kept signed manifest names, read under the bespok3d folder', async () => {
    var printer = printerWhoseJinniFileSays('', keptManifestWith(OTHER_JINNI_FINGERPRINT))

    await expect(installedJinniFingerprint(printer, PRINTER_BESPOK3D_ROOT, 'bespok3d-jinni-example')).resolves.toBe(OTHER_JINNI_FINGERPRINT)
    expect(printer.exec).toHaveBeenCalledWith(expect.stringContaining('/opt/bespok3d-example/var/lib/daemon/manifests/bespok3d-jinni-example.json'))
  })

  it.each(['', '{torn', '{"version": "0.1.12"}'])('carries no fingerprint when the kept manifest reads %j', async (keptManifestText) => {
    await expect(installedJinniFingerprint(printerWhoseJinniFileSays('', keptManifestText), PRINTER_BESPOK3D_ROOT, 'bespok3d-jinni-example')).resolves.toBeNull()
  })
})

describe('a kept daemon whose jinni build differs', () => {
  it('gets the jinni this app offers when the printer runs another build of the same version', async () => {
    var jinniStep = adapterStep('deploy-jinni')
    var printer = printerWhoseJinniFileSays('{"jinni_version": "0.1.12"}', keptManifestWith(OTHER_JINNI_FINGERPRINT))

    await refreshKeptDaemon(adapterWith([jinniStep]), printer, KEEPING_PRINTER)

    expect(jinniStep.run).toHaveBeenCalledWith(printer, expect.objectContaining({ sendChangedFilesOnly: true }))
  })

  it('keeps the jinni it runs when that build is the one this app offers', async () => {
    var jinniStep = adapterStep('deploy-jinni')

    await refreshKeptDaemon(adapterWith([jinniStep]), printerWhoseJinniFileSays('{"jinni_version": "0.1.12"}', keptManifestWith(OFFERED_JINNI_FINGERPRINT)), KEEPING_PRINTER)

    expect(jinniStep.run).not.toHaveBeenCalled()
  })

  it('never sends an older jinni over a newer release, whatever its fingerprint', async () => {
    var jinniStep = adapterStep('deploy-jinni')

    await refreshKeptDaemon(adapterWith([jinniStep]), printerWhoseJinniFileSays('{"jinni_version": "0.1.13"}', keptManifestWith(OTHER_JINNI_FINGERPRINT)), KEEPING_PRINTER)

    expect(jinniStep.run).not.toHaveBeenCalled()
  })
})

describe('a newer daemon the printer keeps', () => {
  it.each(['0.1.11', ''])('gets the jinni this app offers when the printer has %s, sending only what changed', async (installedJinni) => {
    var jinniStep = adapterStep('deploy-jinni')
    var printer = printerWhoseJinniFileSays(installedJinni && `{"jinni_version": "${installedJinni}"}`)

    await refreshKeptDaemon(adapterWith([jinniStep]), printer, KEEPING_PRINTER)

    expect(jinniStep.run).toHaveBeenCalledWith(printer, expect.objectContaining({ sendChangedFilesOnly: true }))
  })

  it.each(['0.1.12', '0.1.13'])('keeps jinni %s, the same as or newer than the one this app offers', async (installedJinni) => {
    var jinniStep = adapterStep('deploy-jinni')

    await refreshKeptDaemon(adapterWith([jinniStep]), printerWhoseJinniFileSays(`{"jinni_version": "${installedJinni}"}`), KEEPING_PRINTER)

    expect(jinniStep.run).not.toHaveBeenCalled()
  })

  it('weighs the jinni against the adapter\'s own when the app ships no jinni package', async () => {
    var jinniStep = adapterStep('deploy-jinni')
    vi.mocked(offeredJinniBuild).mockReturnValue(undefined)

    await refreshKeptDaemon(adapterWith([jinniStep]), printerWhoseJinniFileSays('{"jinni_version": "0.1.9"}'), KEEPING_PRINTER)

    expect(jinniStep.run).not.toHaveBeenCalled()
  })

  it('has the packages it needs installed from the files it brought', async () => {
    var venvStep = adapterStep('refresh-daemon-venv')
    var printer = printerWhoseJinniFileSays('{"jinni_version": "0.1.12"}')

    await refreshKeptDaemon(adapterWith([venvStep]), printer, KEEPING_PRINTER)

    expect(venvStep.run).toHaveBeenCalledWith(printer, KEEPING_PRINTER)
  })

  it('is left alone by an adapter that has neither step', async () => {
    var printer = printerWhoseJinniFileSays('')

    await expect(refreshKeptDaemon(adapterWith([]), printer, KEEPING_PRINTER)).resolves.toBeUndefined()
    expect(printer.exec).not.toHaveBeenCalled()
  })
})
