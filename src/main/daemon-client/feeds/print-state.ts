// Truly-live, event-driven blocked-action state. While the plugin store is open for a managed
// printer the renderer asks main to watch it; main opens ONE pinned wss to the daemon's
// /ws/print-state feed (which relays the jinni's blocked-action TOKEN set on change, no polling) and
// pushes each change to the renderer. The daemon and jinni emit machine tokens, never prose; the
// renderer localizes them. Refusal of plugin ops mid-print is enforced live by the daemon at
// actuation; this feed only drives the proactive UI lock. Each event is timestamped so the renderer
// can treat a long-silent feed as stale and re-verify against the pull (GET /blocked-actions).
// Lifecycle (ref-count, pinned cert, reconnect) lives in feed-pool.
import WebSocket from 'ws'

import { createFeedPool } from './feed-pool'
import type { PrinterRecord } from '../../printers/record'

export interface PrintStateEvent {
  printerId: string
  blockedActions: string[]
  at: number
}

type Send = (event: PrintStateEvent) => void

const pool = createFeedPool()

function feedUrl(record: PrinterRecord, port: number): string | null {
  if (!record.daemonToken) return null

  return `wss://${record.ip}:${port}/ws/print-state?token=${encodeURIComponent(record.daemonToken)}`
}

function parseEvent(data: WebSocket.RawData): string[] | null {
  try {
    const obj = JSON.parse(data.toString())
    if (!Array.isArray(obj.blocked_actions)) return null

    return obj.blocked_actions.filter((token: unknown): token is string => typeof token === 'string')
  } catch {
    return null
  }
}

export function watchPrintState(printerId: string, send: Send): void {
  pool.watch(printerId, printerId, {
    endpoint: feedUrl,
    onMessage: (data) => {
      const blockedActions = parseEvent(data)
      if (blockedActions) send({ printerId, blockedActions, at: Date.now() })
    },
    // Degrade safe: while the feed is down the button unlocks; the daemon still blocks the op live.
    onDisconnect: () => send({ printerId, blockedActions: [], at: Date.now() }),
  })
}

export function unwatchPrintState(printerId: string): void {
  pool.unwatch(printerId)
}

export function closeAllPrintStateWatches(): void {
  pool.closeAll()
}
