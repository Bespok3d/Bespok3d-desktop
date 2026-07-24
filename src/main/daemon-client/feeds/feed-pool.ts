// Shared machinery for the ref-counted, auto-reconnecting daemon feeds (plugin-log, print-state).
// Each feed opens ONE pinned wss per watched key, ref-counts concurrent watchers, and re-arms on an
// unexpected close unless the watch was torn down. The per-feed parts (which URL, how to parse a
// frame, what to emit on disconnect) are supplied as a FeedSpec; this module owns the lifecycle.
import WebSocket from 'ws'

import { makeAgent } from '../client'
import { loadPrinters } from '../../printers'
import type { PrinterRecord } from '../../printers/record'

const RECONNECT_MS = 3000
const DAEMON_PORT = 4269

// The feed-specific behavior: the wss URL for a printer (null = stay idle, e.g. no daemon token), the
// frame handler, and an optional hook fired when the socket drops and a reconnect is queued.
export interface FeedSpec {
  endpoint: (record: PrinterRecord, port: number) => string | null
  onMessage: (data: WebSocket.RawData) => void
  onDisconnect?: () => void
}

interface Watch {
  refs: number
  socket: WebSocket | null
  timer: NodeJS.Timeout | null
  stopped: boolean
  printerId: string
  spec: FeedSpec
}

export interface FeedPool {
  watch: (key: string, printerId: string, spec: FeedSpec) => void
  unwatch: (key: string) => void
  closeAll: () => void
}

function stopWatch(watch: Watch): void {
  watch.stopped = true
  if (watch.timer) clearTimeout(watch.timer)
  watch.socket?.close()
}

function connectWatch(watch: Watch): void {
  const record = loadPrinters().find((printer) => printer.id === watch.printerId)
  if (!record?.daemonCert) return
  const url = watch.spec.endpoint(record, DAEMON_PORT)
  if (!url) return
  // Reuse the daemon-client's pinned agent (pinned cert, skip hostname check, verify chain).
  const socket = new WebSocket(url, { agent: makeAgent(record.daemonCert) })
  watch.socket = socket
  socket.on('message', (data) => watch.spec.onMessage(data))
  socket.on('close', () => scheduleReconnect(watch))
  socket.on('error', () => socket.close())
}

function scheduleReconnect(watch: Watch): void {
  // A torn-down watch (tab/window closed, app quitting) must not re-arm: a close firing after teardown
  // would otherwise reconnect to a printer nobody is watching.
  if (watch.stopped) return
  watch.spec.onDisconnect?.()
  watch.timer = setTimeout(() => { if (!watch.stopped) connectWatch(watch) }, RECONNECT_MS)
}

export function createFeedPool(): FeedPool {
  const watches = new Map<string, Watch>()

  function watch(key: string, printerId: string, spec: FeedSpec): void {
    const existing = watches.get(key)
    if (existing) {
      existing.refs += 1

      return
    }
    const created: Watch = { refs: 1, socket: null, timer: null, stopped: false, printerId, spec }
    watches.set(key, created)
    connectWatch(created)
  }

  function unwatch(key: string): void {
    const found = watches.get(key)
    if (!found) return
    found.refs -= 1
    if (found.refs > 0) return
    stopWatch(found)
    watches.delete(key)
  }

  function closeAll(): void {
    watches.forEach(stopWatch)
    watches.clear()
  }

  return { watch, unwatch, closeAll }
}
