// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import { startRawScan, stopRawScan } from './raw'
import { startDnsSdScan } from './dnssd'
import { startArpRefresh, stopArpRefresh } from './arp'

var stopDnsSd: (() => void) | null = null

export type { DiscoveredPrinterRecord } from './types'

export function startMdnsScan(win: BrowserWindow): void {
  stopMdnsScan()
  const emitted = new Set<string>()
  startArpRefresh()
  startRawScan(win, emitted)
  stopDnsSd = startDnsSdScan(win, emitted) ?? null
}

export function stopMdnsScan(): void {
  stopArpRefresh()
  stopRawScan()
  stopDnsSd?.()
  stopDnsSd = null
}
