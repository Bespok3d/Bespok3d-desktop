import { ipcRenderer, webUtils } from 'electron'
import { subscribe } from './subscribe'
import type { AddLocalResult } from '../main/registry/local'

export const localStoreApi = {
  add: (paths: string[]): Promise<AddLocalResult> => ipcRenderer.invoke('localStore:add', paths),
  doc: (id: string, relativePath: string): Promise<string | null> =>
    ipcRenderer.invoke('localStore:doc', id, relativePath),
  removeContext: (id: string): Promise<{ printers: { id: string; nick: string }[]; hasOtherSource: boolean }> =>
    ipcRenderer.invoke('localStore:removeContext', id),
  remove: (id: string, uninstallFrom: string[]): Promise<void> =>
    ipcRenderer.invoke('localStore:remove', id, uninstallFrom),
  // Resolve dropped File objects to OS paths (the renderer cannot read File.path under Electron 42).
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  onAdded: (callback: (result: AddLocalResult) => void): (() => void) =>
    subscribe('localStore:added', callback),
}
