// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { exec } from 'child_process'
import { readFile } from 'fs/promises'
import { platform } from 'os'
import { parseArpTable } from './arp-parse'

// The MAC of a discovered device is not in its mDNS records; it lives in the OS arp
// table once we have talked to that IP. We read the table on a slow timer and serve
// it synchronously so emit() can stamp a record without awaiting per device.
var macByIp = new Map<string, string>()
var refreshTimer: ReturnType<typeof setInterval> | null = null

const REFRESH_MS = 4000

function readCommand(command: string): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { timeout: 4000 }, (_error, stdout) => resolve(stdout ?? ''))
  })
}

async function readArpSource(): Promise<string> {
  if (platform() === 'linux') return readFile('/proc/net/arp', 'utf8').catch(() => '')
  if (platform() === 'win32') return readCommand('arp -a')

  return readCommand('arp -an')
}

async function refreshArpTable(): Promise<void> {
  const text = await readArpSource()
  if (text) macByIp = parseArpTable(text)
}

export function macForIp(ip: string): string | undefined {
  return macByIp.get(ip)
}

export function startArpRefresh(): void {
  void refreshArpTable()
  if (refreshTimer) return
  refreshTimer = setInterval(() => void refreshArpTable(), REFRESH_MS)
}

export function stopArpRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}
