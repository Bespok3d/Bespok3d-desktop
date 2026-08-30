// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { runRepair } from '../../src/main/ops/daemon-ops'
import { savePrinter } from '../../src/main/printers'
import { fetchDaemonStatus } from '../../src/main/daemon-client/client'
import { expectedDaemonVersion } from '../../src/main/daemon-client/expected-version'
import { makeDeviceTarget } from './device-target'

// The hardware bench, put back on its feet after a run left its daemon down. A shared bot is not a
// container: a suite that dies mid-way leaves the next person a printer that answers nothing, and the
// only sanctioned way back is the same Repair a user clicks in the app. Never a hand edit on the device.
// Inert unless B3D_BENCH_RESTORE is set, so it never runs as part of an ordinary suite.
// Run: B3D_BENCH_RESTORE=1 B3D_DEVICE_TARGET=real-u1 B3D_HIL_HOST=... npx vitest run --config vitest.invitro.config.ts bench-restore
const PRINTER_ID = 'invitro-bench-restore'
const RESTORE_TIMEOUT_MS = 600000

function fakeWindow(): BrowserWindow {
  return { webContents: { send: vi.fn() } } as unknown as BrowserWindow
}

describe.skipIf(!process.env.B3D_BENCH_RESTORE)('the hardware bench after a run left its daemon down', () => {
  it('brings the bot back to the bundled daemon through the app repair path', async () => {
    const target = makeDeviceTarget(0)
    // prepare() reads the bot's cert and token off the device and only then starts the daemon, so a
    // bench that needs restoring is exactly the bench whose prepare cannot finish. Take what it read.
    await target.prepare().catch((daemonDown) => console.warn('[bench] daemon down, repairing:', daemonDown))
    const device = target.daemonRecord()
    expect(device.daemonToken, 'could not read the bot daemon credentials over SSH').toBeTruthy()

    const ssh = target.sshCredentials()
    savePrinter({
      id: PRINTER_ID, nick: 'in-vitro bench restore', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
      host: device.ip, ip: device.ip, status: 'managed', installedIds: [],
      daemonCert: device.daemonCert, daemonToken: device.daemonToken,
    })
    await runRepair(fakeWindow(), PRINTER_ID, ssh.host, ssh.user, ssh.password, ssh.port)

    const after = await fetchDaemonStatus(device)
    expect(after.version).toBe(expectedDaemonVersion())
  }, RESTORE_TIMEOUT_MS)
})
