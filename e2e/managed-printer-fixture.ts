// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { StubDaemon } from './stub-daemon'
import { bundledDaemonVersion } from './app-launch'

export function seedManagedPrinter(userData: string, daemon: StubDaemon): void {
  const printersDir = join(userData, 'printers')
  mkdirSync(printersDir, { recursive: true })
  const record = {
    id: 'demo-u1', nick: 'Workshop U1', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
    host: 'demo-u1.local', ip: '127.0.0.1', status: 'managed', installedIds: [],
    daemonVersion: bundledDaemonVersion(), daemonCert: daemon.cert, daemonToken: daemon.token,
  }
  writeFileSync(join(printersDir, 'demo-u1.json'), JSON.stringify(record, null, 2), 'utf8')
}
