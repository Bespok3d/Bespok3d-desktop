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

// Announce the ordered plan, then mirror the daemon's live install feed to the renderer as the batch
// runs, resolving with the close fn to call once it settles. The renderer ticks each plugin from these
// events; an old daemon with no feed just never sends past the plan (the install still completes).
export async function streamBatchProgress(win: BrowserWindow, printerId: string, record: ProgressTarget, orderedIds: string[]): Promise<() => void> {
  send(win, printerId, { type: 'plan', ids: orderedIds })

  return watchInstallProgress(record, (event) => {
    const batchEvent = batchEventFrom(event)
    if (batchEvent) send(win, printerId, batchEvent)
  })
}
