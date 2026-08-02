// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { subscribe } from './subscribe'
import { EXPECTED_DAEMON_VERSION } from '../main/daemon-client/version'
import type { B3dRoute } from '../main/protocol/url'
import { settingsApi } from './settings'
import { appUpdateApi } from './app-update'
import { keysApi } from './keys'
import { printersApi } from './printers'
import { accessApi } from './access'
import { mdnsApi } from './mdns'
import { storeApi } from './store'
import { registryApi } from './registry'
import { localStoreApi } from './local-store'
import { devToolsApi } from './dev-tools'
import { gitHostApi } from './git-host'
import { analyticsApi } from './analytics'

const b3dAPI = {
  platform: process.platform,
  arch: process.arch,
  // Set B3D_DEV_FEATURES=1 to reveal the parts a release build hides (Create, Keys, Labs) in a
  // packaged app. A dev run shows them anyway (utils/unreleased-features.ts).
  unreleasedFeaturesForced: process.env.B3D_DEV_FEATURES === '1',
  daemonExpectedVersion: EXPECTED_DAEMON_VERSION,
  openUrl: (url: string): Promise<void> => ipcRenderer.invoke('shell:openUrl', url),
  // The menu "About" item (macOS app menu / Help menu elsewhere) opens our Settings > About pane.
  onOpenAbout: (callback: () => void): (() => void) => subscribe('app:open-about', callback),
  // A b3d:// deep link the OS handed us (entity / registry-add / printer); the renderer confirms
  // before any state change. Auth callbacks never reach here (the PKCE waiter consumes them).
  onB3dOpen: (callback: (route: B3dRoute) => void): (() => void) => subscribe('b3d:open', callback),

  settings: settingsApi,
  appUpdate: appUpdateApi,
  keys: keysApi,
  printers: printersApi,
  access: accessApi,
  mdns: mdnsApi,
  store: storeApi,
  registry: registryApi,
  localStore: localStoreApi,
  devTools: devToolsApi,
  gitHost: gitHostApi,
  analytics: analyticsApi,
}

// The single source of truth for the renderer's window.b3d surface: env.d.ts binds Window['b3d'] to
// this, so the typed API and the runtime bridge can never drift.
export type B3dApi = typeof b3dAPI

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('b3d', b3dAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error not isolated
  window.electron = electronAPI
  // @ts-expect-error not isolated
  window.b3d = b3dAPI
}
