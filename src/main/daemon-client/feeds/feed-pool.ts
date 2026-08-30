// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
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
// What the daemon actually sends on these feeds is a short list of tokens or a single line of a
// plugin log. Anything bigger is not one of those, and left uncapped the ws default lets a printer
// that has been taken over hand this app a hundred megabytes to hold in memory per frame, as fast as
// it can send them, until the app is killed for the memory it is holding. Over the cap the socket
// closes and the watch reconnects, which is what it already does for every other way a feed drops.
export const MAX_FRAME_BYTES = 256 * 1024

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

// One frame that could not be dealt with costs that frame and nothing else. The reader runs inside the
// socket's own message event, where a throw is caught by nobody: it goes all the way up as an
// exception the app has no handler for and takes the whole app down with it, so a printer that has
// been taken over closes the app on the owner just by answering with something the reader chokes on.
// The feed stays open and the next frame is read as normal.
function deliverFrame(watch: Watch, data: WebSocket.RawData): void {
  try {
    watch.spec.onMessage(data)
  } catch (unreadable) {
    console.warn(`[feed] a frame from printer ${watch.printerId} was dropped: ${String(unreadable)}`)
  }
}

function connectWatch(watch: Watch): void {
  const record = loadPrinters().find((printer) => printer.id === watch.printerId)
  if (!record?.daemonCert) return
  const url = watch.spec.endpoint(record, DAEMON_PORT)
  if (!url) return
  // Reuse the daemon-client's pinned agent (pinned cert, skip hostname check, verify chain).
  const socket = new WebSocket(url, { agent: makeAgent(record.daemonCert), maxPayload: MAX_FRAME_BYTES })
  watch.socket = socket
  socket.on('message', (data) => deliverFrame(watch, data))
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
