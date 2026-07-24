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
