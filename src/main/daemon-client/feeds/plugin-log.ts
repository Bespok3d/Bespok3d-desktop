// Live capture of a plugin's service log. While the Captured tab is open for a managed printer the
// renderer asks main to watch one plugin; main opens ONE pinned wss to the daemon's
// /ws/plugin-log/<id> feed (which tails the service log and emits each new URL/regex match) and
// pushes it to the renderer. The daemon re-emits current matches on connect, so a link logged before
// the user looked is captured too. Lifecycle (ref-count, pinned cert, reconnect) lives in feed-pool.
import WebSocket from 'ws'

import { createFeedPool } from './feed-pool'
import type { PrinterRecord } from '../../printers/record'

export interface PluginLogEvent {
  printerId: string
  pluginId: string
  value: string
  pattern: string
}

// What main pushes to the renderer: the new match plus the full deduped capture list for that plugin
// (main persists each value to the printer record first), so the renderer just replaces its state.
export interface PluginLogPush extends PluginLogEvent {
  captures: string[]
}

type Send = (event: PluginLogEvent) => void

const pool = createFeedPool()

function watchKey(printerId: string, pluginId: string): string {
  return `${printerId}:${pluginId}`
}

function feedUrl(record: PrinterRecord, port: number, pluginId: string): string | null {
  if (!record.daemonToken) return null
  const token = encodeURIComponent(record.daemonToken)

  return `wss://${record.ip}:${port}/ws/plugin-log/${encodeURIComponent(pluginId)}?token=${token}`
}

function parseEvent(data: WebSocket.RawData): { value: string; pattern: string } | null {
  try {
    const obj = JSON.parse(data.toString())
    if (typeof obj.value !== 'string' || !obj.value) return null

    return { value: obj.value, pattern: typeof obj.pattern === 'string' ? obj.pattern : 'url' }
  } catch {
    return null
  }
}

export function watchPluginLog(printerId: string, pluginId: string, send: Send): void {
  pool.watch(watchKey(printerId, pluginId), printerId, {
    endpoint: (record, port) => feedUrl(record, port, pluginId),
    onMessage: (data) => {
      const parsed = parseEvent(data)
      if (parsed) send({ printerId, pluginId, value: parsed.value, pattern: parsed.pattern })
    },
  })
}

export function unwatchPluginLog(printerId: string, pluginId: string): void {
  pool.unwatch(watchKey(printerId, pluginId))
}

export function closeAllPluginLogWatches(): void {
  pool.closeAll()
}
