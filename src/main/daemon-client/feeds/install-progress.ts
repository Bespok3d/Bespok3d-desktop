// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// One-shot live install-progress feed. While an install POST is in flight, main holds a wss to the
// daemon's /ws/install-progress bridge and forwards each phase to the renderer, so the install stops
// being an opaque wait. The socket is opened (and awaited) before the POST so no phase is missed; the
// daemon replays the current run's events on connect to cover the connect-vs-first-event race. An old
// daemon without the route, or any connect failure, degrades to no live feed (the install still runs).
// While open, the feed also tells the app whether the printer is still at work (printer-at-work.ts).
import WebSocket from 'ws'

import { makeAgent } from '../client'
import { reportPrinterWork } from '../printer-at-work'
import { MAX_FRAME_BYTES } from './feed-pool'
import { DAEMON_PORT } from '../../printers/ports'
import type { InstallLogPhase } from '@bespok3d/contract'

interface ProgressTarget {
  id: string
  ip: string
  daemonCert?: string
  daemonToken?: string
}

export interface InstallProgressEvent {
  type: 'phase' | 'plugin' | 'plan' | 'done'
  phase?: InstallLogPhase
  // The ordered set a run will work through. Only recovery sends one: the printer decides which
  // plugins it puts back and in what order, where a batch's set is decided in the app.
  ids?: string[]
  // On a batch, a 'plugin' event names the plugin a batch is starting (the deferred restart step
  // arrives as a 'plugin' under the '(services)' id with index === total).
  pluginId?: string
  index?: number
  total?: number
  ok?: boolean
  error?: string
}

// The renderer-facing batch progress vocabulary: the ordered plan up front, then each plugin as it
// starts, each phase as it finishes, and a terminal done. Translated from the daemon feed by
// batchEventFrom so the renderer never parses raw phase shapes.
export type BatchProgressEvent =
  | { type: 'plan'; ids: string[] }
  | { type: 'plugin'; pluginId: string; index: number; total: number }
  | { type: 'phase'; label: string; ok: boolean }
  | { type: 'done'; ok: boolean }

// The client-side upload stage: bytes written to the daemon over the wire, reported by main as it
// streams the multipart. Distinct from the phase feed above (the daemon only sees the request once the
// whole body has arrived), so it rides its own IPC channel and is shared by single and batch installs.
export interface UploadProgressEvent {
  printerId: string
  sent: number
  total: number
}

// The app pings the printer on the feed and the printer answers each ping, so a feed that stays
// silent through three pings means the link or the printer is gone, even though the socket still
// looks open (a printer that drops off the network never says goodbye).
const FEED_PING_MS = 15000
const FEED_SILENCE_LIMIT_MS = 45000
// A printer that drops packets never refuses the connection, so without a limit the opening handshake
// waits for the system's own connect timeout, holding the install back before it is even sent.
const FEED_HANDSHAKE_LIMIT_MS = 10000

// A run is under way from its first event until its terminal done.
interface RunWatch {
  runUnderWay: boolean
  lastHeardAt: number
}

function heardFromThePrinter(runWatch: RunWatch): void {
  runWatch.lastHeardAt = Date.now()
}

function trackRun(runWatch: RunWatch, event: InstallProgressEvent): void {
  runWatch.runUnderWay = event.type !== 'done'
}

function printerIsAtWork(socket: WebSocket, runWatch: RunWatch): boolean {
  const linkIsAlive = socket.readyState === socket.OPEN && Date.now() - runWatch.lastHeardAt < FEED_SILENCE_LIMIT_MS

  return runWatch.runUnderWay && linkIsAlive
}

// A ping before the socket opens throws, and one after it closes is pointless.
function pingWhenOpen(socket: WebSocket): void {
  if (socket.readyState === socket.OPEN) socket.ping()
}

// Report the printer's work for as long as the socket lives, and ping it so a silent link shows.
// Returns the function that stops both.
function reportWorkWhileOpen(printerId: string, socket: WebSocket, runWatch: RunWatch): () => void {
  const withdrawReport = reportPrinterWork(printerId, () => printerIsAtWork(socket, runWatch))
  const pinger = setInterval(() => pingWhenOpen(socket), FEED_PING_MS)

  return () => {
    clearInterval(pinger)
    withdrawReport()
  }
}

function closeSocket(socket: WebSocket): void {
  try { socket.close() } catch { /* already closing */ }
}

// Resolves once the feed is live (or immediately when it cannot be opened) with a close function the
// caller runs when the install settles. Errors resolve to a no-op close so the install proceeds blind.
export function watchInstallProgress(record: ProgressTarget, onEvent: (event: InstallProgressEvent) => void): Promise<() => void> {
  return new Promise((resolve) => {
    if (!record.daemonCert || !record.daemonToken) return resolve(() => {})
    const url = `wss://${record.ip}:${DAEMON_PORT}/ws/install-progress?token=${encodeURIComponent(record.daemonToken)}`
    const socket = new WebSocket(url, { agent: makeAgent(record.daemonCert), maxPayload: MAX_FRAME_BYTES, handshakeTimeout: FEED_HANDSHAKE_LIMIT_MS })
    const runWatch: RunWatch = { runUnderWay: false, lastHeardAt: Date.now() }
    const stopReporting = reportWorkWhileOpen(record.id, socket, runWatch)
    function close(): void { stopReporting(); closeSocket(socket) }
    socket.on('open', () => resolve(close))
    socket.on('message', (data) => {
      heardFromThePrinter(runWatch)
      relay(data, (event) => { trackRun(runWatch, event); onEvent(event) })
    })
    socket.on('ping', () => heardFromThePrinter(runWatch))
    socket.on('pong', () => heardFromThePrinter(runWatch))
    socket.on('close', stopReporting)
    socket.on('error', () => { close(); resolve(() => {}) })
  })
}

// Same boundary the shared feed pool puts around a frame: this runs inside the socket's own message
// event, where a throw is caught by nobody and would take the whole app down mid-install. One frame
// nothing could be done with costs that frame, and the install carries on reporting the next one.
function relay(data: WebSocket.RawData, onEvent: (event: InstallProgressEvent) => void): void {
  const parsed = parseEvent(data)
  if (!parsed) return

  try {
    onEvent(parsed)
  } catch (unreadable) {
    console.warn(`[feed] an install-progress frame was dropped: ${String(unreadable)}`)
  }
}

export function parseEvent(data: WebSocket.RawData): InstallProgressEvent | null {
  try {
    const obj = JSON.parse(data.toString())
    if (obj.type === 'phase' && obj.phase) return { type: 'phase', phase: obj.phase as InstallLogPhase }
    if (obj.type === 'plan' && Array.isArray(obj.ids)) return { type: 'plan', ids: obj.ids as string[] }
    if (obj.type === 'plugin' && typeof obj.plugin_id === 'string') return { type: 'plugin', pluginId: obj.plugin_id, index: obj.index ?? 0, total: obj.total ?? 0 }
    if (obj.type === 'done') return { type: 'done', ok: !!obj.ok, error: typeof obj.error === 'string' ? obj.error : undefined }

    return null
  } catch {
    return null
  }
}

// Translate one daemon feed event into the renderer-facing batch event, or null for events the batch
// view does not show (a non-plugin/phase/done message).
export function batchEventFrom(event: InstallProgressEvent): BatchProgressEvent | null {
  if (event.type === 'plan' && event.ids) return { type: 'plan', ids: event.ids }
  if (event.type === 'plugin' && event.pluginId) {
    return { type: 'plugin', pluginId: event.pluginId, index: event.index ?? 0, total: event.total ?? 0 }
  }
  if (event.type === 'phase' && event.phase) return { type: 'phase', label: installPhaseMessage(event.phase), ok: event.phase.ok }
  if (event.type === 'done') return { type: 'done', ok: !!event.ok }

  return null
}

// The live step message for a phase: its label, or the failing item's output on a failed phase.
export function installPhaseMessage(phase: InstallLogPhase): string {
  if (phase.ok) return phase.label
  const failed = phase.items.find((item) => !item.ok)

  return failed?.output ? `${phase.label} failed: ${failed.output}` : `${phase.label} failed`
}
