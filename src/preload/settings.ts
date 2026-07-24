import { ipcRenderer } from 'electron'
import type { AppSettings } from '../main/settings'

export const settingsApi = {
  get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),
}
