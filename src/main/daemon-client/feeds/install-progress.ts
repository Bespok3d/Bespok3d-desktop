// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// One-shot live install-progress feed. While an install POST is in flight, main holds a wss to the
// daemon's /ws/install-progress bridge and forwards each phase to the renderer, so the install stops
// being an opaque wait. The socket is opened (and awaited) before the POST so no phase is missed; the
// daemon replays the current run's events on connect to cover the connect-vs-first-event race. An old
// daemon without the route, or any connect failure, degrades to no live feed (the install still runs).
import WebSocket from 'ws'

import { makeAgent } from '../client'
import { MAX_FRAME_BYTES } from './feed-pool'
import type { InstallLogPhase } from '@bespok3d/contract'

interface ProgressTarget {
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

const DAEMON_PORT = 4269

// Resolves once the feed is live (or immediately when it cannot be opened) with a close function the
// caller runs when the install settles. Errors resolve to a no-op close so the install proceeds blind.
export function watchInstallProgress(record: ProgressTarget, onEvent: (event: InstallProgressEvent) => void): Promise<() => void> {
  return new Promise((resolve) => {
    if (!record.daemonCert || !record.daemonToken) return resolve(() => {})
    const url = `wss://${record.ip}:${DAEMON_PORT}/ws/install-progress?token=${encodeURIComponent(record.daemonToken)}`
    const socket = new WebSocket(url, { agent: makeAgent(record.daemonCert), maxPayload: MAX_FRAME_BYTES })
    function close(): void { try { socket.close() } catch { /* already closing */ } }
    socket.on('open', () => resolve(close))
    socket.on('message', (data) => relay(data, onEvent))
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
