import { ipcRenderer } from 'electron'
import type { AppSettings, ReleaseChannel } from '../main/settings'
import type { Catalog } from '../main/registry'

export const registryApi = {
  catalog: (): Promise<Catalog> => ipcRenderer.invoke('registry:catalog'),
  setSourceEnabled: (url: string, enabled: boolean): Promise<Catalog> =>
    ipcRenderer.invoke('registry:setSourceEnabled', url, enabled),
  setChannelEnabled: (channel: ReleaseChannel, enabled: boolean): Promise<AppSettings> =>
    ipcRenderer.invoke('registry:setChannelEnabled', channel, enabled),
  assetInfo: (url: string): Promise<{ downloadCount: number | null; publishedAt: string | null }> =>
    ipcRenderer.invoke('registry:assetInfo', url),
}
