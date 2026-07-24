/// <reference types="vite/client" />

import type { B3dApi } from '../../preload'

// The renderer imports these by name from '../env'; they are re-exported from their single source so
// the renderer never re-declares a main-process shape. PrinterRecord is the secret-stripped projection
// (the daemon credentials never cross IPC), so the renderer's PrinterRecord type cannot carry them.
export type { DiscoveredPrinterRecord } from '../../main/mdns'
export type { PublicPrinterRecord as PrinterRecord } from '../../main/printers'
export type { Endpoint } from '@bespok3d/contract'
export type { Catalog } from '../../main/registry'

declare global {
  const __APP_VERSION__: string

  // The window.b3d surface IS the preload bridge: binding it to typeof b3dAPI makes the typed API and
  // the runtime object one thing, so a handler added to the bridge needs no second declaration here.
  interface Window {
    b3d: B3dApi
  }

  // Wire and main-process types the renderer also names directly (not only through window.b3d). Each
  // is aliased from its single source, so an ambient name can never drift from the shape it mirrors.
  type AdapterInfo = import('../../main/adapter-loader').AdapterInfo
  type EnrollmentLog = import('../../main/printers').EnrollmentLog
  type EnrollmentLogStep = import('../../main/printers').EnrollmentLogStep
  type EnrollProgressEvent = import('../../main/enrollment').EnrollProgressEvent
  type PrintStateEvent = import('../../main/daemon-client/feeds/print-state').PrintStateEvent
  type PluginLogPush = import('../../main/daemon-client/feeds/plugin-log').PluginLogPush
  type GitHostAccount = import('../../main/git-host/connector').GitHostAccount
  type GitHostSettings = import('../../main/git-host').GitHostSettings
  type GitHostConnectionRequest = import('../../main/git-host/connector').ConnectionRequest
  type TokenInfo = import('../../main/git-host/connector').TokenInfo
  type RepoInfo = import('../../main/git-host/connector').RepoInfo
  type UpdateAvailablePayload = import('../../main/app-update/view').UpdateAvailablePayload
  type AppReleaseRow = import('../../main/app-update/view').AppReleaseRow
  type UpdateFrequency = import('../../main/app-update/schedule').UpdateFrequency
  type AppSettings = import('../../main/settings').AppSettings
  type UpdatePrefs = Pick<AppSettings, 'appUpdateFrequency' | 'appUpdateAutoDownload' | 'appUpdateInstallOnQuit'>
  type CapabilitiesResult = import('@bespok3d/contract').CapabilitiesResult
  type PluginRecoveryResult = import('@bespok3d/contract').PluginRecoveryResult
  type RecoverResult = import('@bespok3d/contract').RecoverResult
  type InstallLog = import('@bespok3d/contract').InstallLog
  type InstallLogItem = import('@bespok3d/contract').InstallLogItem
  type InstallLogPhase = import('@bespok3d/contract').InstallLogPhase
  type PluginUpdateSpec = import('../../main/store/update-batch').PluginUpdateSpec
  type PluginProgressEvent = import('../../main/store/progress').PluginProgressEvent
  type PatchSession = import('../../main/dev-tools/types').PatchSession
}

export {}
