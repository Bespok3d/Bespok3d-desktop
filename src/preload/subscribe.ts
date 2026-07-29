// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'

// Wraps an ipcRenderer channel listener as a subscribe-returns-unsubscribe pair, the shape every
// on*() bridge method exposes to the renderer.
export function subscribe<Payload>(channel: string, callback: (payload: Payload) => void): () => void {
  function listener(_ipcEvent: Electron.IpcRendererEvent, payload: Payload) {
    callback(payload)
  }
  ipcRenderer.on(channel, listener)

  return () => ipcRenderer.removeListener(channel, listener)
}
