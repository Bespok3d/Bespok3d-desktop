// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'

import { watchInstallProgress, batchEventFrom } from '../daemon-client/feeds/install-progress'
import type { BatchProgressEvent } from '../daemon-client/feeds/install-progress'

interface ProgressTarget {
  ip: string
  daemonCert?: string
  daemonToken?: string
}

function send(win: BrowserWindow, printerId: string, event: BatchProgressEvent): void {
  if (!win.isDestroyed()) win.webContents.send('store:batchProgress', { printerId, event })
}

// Mirror the daemon's live feed to the renderer, resolving with the close fn the caller runs once the
// operation settles. Shared by every operation that shows live per-plugin progress.
function mirrorDaemonProgress(win: BrowserWindow, printerId: string, record: ProgressTarget): Promise<() => void> {
  return watchInstallProgress(record, (event) => {
    const batchEvent = batchEventFrom(event)
    if (batchEvent) send(win, printerId, batchEvent)
  })
}

// Announce the ordered plan, then mirror the daemon's live install feed to the renderer as the batch
// runs. The renderer ticks each plugin from these events; an old daemon with no feed just never sends
// past the plan (the install still completes).
export async function streamBatchProgress(win: BrowserWindow, printerId: string, record: ProgressTarget, orderedIds: string[]): Promise<() => void> {
  send(win, printerId, { type: 'plan', ids: orderedIds })

  return mirrorDaemonProgress(win, printerId, record)
}

// Recovery's live feed. No plan is sent from here: the printer decides which plugins it puts back and
// in what order, so its plan arrives on the feed and an app-built one would name the wrong plugin.
export function streamRecoverProgress(win: BrowserWindow, printerId: string, record: ProgressTarget): Promise<() => void> {
  return mirrorDaemonProgress(win, printerId, record)
}
