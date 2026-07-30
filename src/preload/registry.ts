// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import type { AppSettings, ReleaseChannel } from '../main/settings'
import type { Catalog } from '../main/registry'
import type { RefreshOffer } from '../main/registry/listing-refresh'
import type { RefreshPassResult } from '../main/registry/refresh-pass'

export const registryApi = {
  catalog: (): Promise<Catalog> => ipcRenderer.invoke('registry:catalog'),
  setSourceEnabled: (url: string, enabled: boolean): Promise<Catalog> =>
    ipcRenderer.invoke('registry:setSourceEnabled', url, enabled),
  setChannelEnabled: (channel: ReleaseChannel, enabled: boolean): Promise<AppSettings> =>
    ipcRenderer.invoke('registry:setChannelEnabled', channel, enabled),
  assetInfo: (url: string): Promise<{ downloadCount: number | null; publishedAt: string | null }> =>
    ipcRenderer.invoke('registry:assetInfo', url),
  // null when the listed version is already the newest one the plugin's repo has released, and also
  // when that repo cannot be asked. Either way the store keeps showing the listed version.
  freshestVersion: (pluginId: string, sourceUrl?: string): Promise<string | null> =>
    ipcRenderer.invoke('registry:freshestVersion', pluginId, sourceUrl),
  // Whether an install should offer to refresh the plugin list first, and how old that list is. Asking
  // is what records the offer, so this is called at the install, never to render something.
  refreshOffer: (): Promise<RefreshOffer> => ipcRenderer.invoke('registry:refreshOffer'),
  // Re-asks the plugins' own repos what they last released, then reports what moved.
  refreshListing: (): Promise<RefreshPassResult> => ipcRenderer.invoke('registry:refreshListing'),
}
