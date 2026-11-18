// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The printer's active watch, live. The daemon reads the printer's own log and, when it recognises a
// known fault, carries out the remedy the user chose and sends one frame here: the fault's token, the
// remedy, and for a reboot the reboot's id. A reboot announced but then not done (a print started
// meanwhile, its state could not be read, the printer refused it, or it is still up long after) is
// taken back by a notify frame carrying that reboot's id. Nothing is replayed.
// Lifecycle (ref-count, pinned cert, reconnect) lives in feed-pool.
import type WebSocket from 'ws'

import { createFeedPool } from './feed-pool'
import type { PrinterRecord } from '../../printers/record'

export type ActiveWatchRemedy = 'notify' | 'reboot'

export interface ActiveWatchEvent {
  printerId: string
  token: string
  remedy: ActiveWatchRemedy
  noticeId?: string
}

type Send = (event: ActiveWatchEvent) => void

const pool = createFeedPool()

function feedUrl(record: PrinterRecord, port: number): string | null {
  if (!record.daemonToken) return null

  return `wss://${record.ip}:${port}/ws/active-watch?token=${encodeURIComponent(record.daemonToken)}`
}

function isRemedy(remedy: unknown): remedy is ActiveWatchRemedy {
  return remedy === 'notify' || remedy === 'reboot'
}

function frameOrNothing(data: WebSocket.RawData): Record<string, unknown> | null {
  try {
    const frame: unknown = JSON.parse(data.toString())

    return typeof frame === 'object' && frame !== null ? frame as Record<string, unknown> : null
  } catch {
    return null
  }
}

function takenBackNotice(frame: Record<string, unknown>): Pick<ActiveWatchEvent, 'noticeId'> {
  return typeof frame.id === 'string' ? { noticeId: frame.id } : {}
}

// A reboot frame without its id could never be taken back, so it is dropped like any frame this app
// cannot read.
function parseEvent(printerId: string, data: WebSocket.RawData): ActiveWatchEvent | null {
  const frame = frameOrNothing(data)
  if (!frame || typeof frame.token !== 'string' || !isRemedy(frame.remedy)) return null
  if (frame.remedy === 'notify') return { printerId, token: frame.token, remedy: 'notify', ...takenBackNotice(frame) }
  if (typeof frame.id !== 'string') return null

  return { printerId, token: frame.token, remedy: 'reboot', noticeId: frame.id }
}

export function watchActiveWatch(printerId: string, send: Send): void {
  pool.watch(printerId, printerId, {
    endpoint: feedUrl,
    onMessage: (data) => {
      const event = parseEvent(printerId, data)
      if (event) send(event)
    },
  })
}

export function unwatchActiveWatch(printerId: string): void {
  pool.unwatch(printerId)
}

export function closeAllActiveWatchWatches(): void {
  pool.closeAll()
}
