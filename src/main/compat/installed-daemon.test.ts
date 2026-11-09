// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect, vi } from 'vitest'
import type { SshSession } from '../ssh'

vi.mock('../daemon-client/expected-version', () => ({ expectedDaemonVersion: () => '0.14.0' }))

import { installedDaemonVersion, keepingNewerInstalledDaemon } from './installed-daemon'

const DAEMON_VERSION_SOURCE = fileURLToPath(new URL('../../../../daemon/version.py', import.meta.url))

function printerWhoseVersionFileSays(versionFileText: string): SshSession {
  return { exec: vi.fn().mockResolvedValue(versionFileText) } as unknown as SshSession
}

describe('the daemon the printer has on its disk', () => {
  it('is the version its version file names', async () => {
    var printer = printerWhoseVersionFileSays('# header\nDAEMON_VERSION = "0.14.1"\nMIN_JINNI_VERSION = "0.1.10"\n')

    await expect(installedDaemonVersion(printer)).resolves.toBe('0.14.1')
  })

  it('is none when the printer has no daemon files', async () => {
    await expect(installedDaemonVersion(printerWhoseVersionFileSays(''))).resolves.toBeNull()
  })

  it.skipIf(!existsSync(DAEMON_VERSION_SOURCE))('is still read from the version file the daemon ships', async () => {
    var printer = printerWhoseVersionFileSays(readFileSync(DAEMON_VERSION_SOURCE, 'utf-8'))

    await expect(installedDaemonVersion(printer)).resolves.toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('an enrollment step', () => {
  it('is left as the adapter wrote it unless it deploys the daemon', () => {
    var startStep = { id: 'start-daemon', label: 'Start', detail: '', run: vi.fn() }

    expect(keepingNewerInstalledDaemon(startStep)).toBe(startStep)
  })
})
