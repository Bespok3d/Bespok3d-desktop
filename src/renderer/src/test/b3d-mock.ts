// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { vi } from 'vitest'
import type { DiscoveredPrinterRecord } from '../env'
import type { AddLocalResult, ReleaseChannel } from '../data/types'
import { EXPECTED_DAEMON_VERSION } from '../../../main/daemon-client/version'
import type { BatchProgressEvent, UploadProgressEvent } from '../../../main/daemon-client/feeds/install-progress'
import { makeCapabilities, makeCatalog, makeInstallLog, makeAdapterInfo, makeKey } from './fixtures'

export type B3d = Window['b3d']
export type B3dOverrides = { [Group in keyof B3d]?: Partial<B3d[Group]> }

// A driveable event channel: components register a callback (and get an unsubscribe), tests push
// synthetic events through `emit`. The on* IPC mocks MUST return this unsubscribe, or the success
// paths in usePluginOps / usePrintState / useEnrollment throw on teardown.
interface Channel<Event> {
  register: (callback: (event: Event) => void) => () => void
  emit: (event: Event) => void
}

function makeChannel<Event>(): Channel<Event> {
  var callbacks: Array<(event: Event) => void> = []
  function register(callback: (event: Event) => void): () => void {
    callbacks.push(callback)

    return function unregister() {
      callbacks = callbacks.filter((existing) => existing !== callback)
    }
  }
  function emit(event: Event): void {
    callbacks.forEach((callback) => callback(event))
  }

  return { register, emit }
}

type BatchProgressPush = { printerId: string; event: BatchProgressEvent }

interface Channels {
  enrollProgress: Channel<EnrollProgressEvent>
  pluginProgress: Channel<PluginProgressEvent>
  batchProgress: Channel<BatchProgressPush>
  uploadProgress: Channel<UploadProgressEvent>
  pluginLog: Channel<PluginLogPush>
  printState: Channel<PrintStateEvent>
  found: Channel<DiscoveredPrinterRecord>
  localAdded: Channel<AddLocalResult>
  updateAvailable: Channel<UpdateAvailablePayload>
  upToDate: Channel<string>
  downloadProgress: Channel<number>
  updateDownloaded: Channel<string>
  updateError: Channel<string>
  openAbout: Channel<void>
  openSettings: Channel<void>
}

function makeChannels(): Channels {
  return {
    enrollProgress: makeChannel(), pluginProgress: makeChannel(), batchProgress: makeChannel(),
    uploadProgress: makeChannel(),
    pluginLog: makeChannel(),
    printState: makeChannel(),
    found: makeChannel(), localAdded: makeChannel(), updateAvailable: makeChannel(),
    upToDate: makeChannel(), downloadProgress: makeChannel(), updateDownloaded: makeChannel(),
    updateError: makeChannel(), openAbout: makeChannel(), openSettings: makeChannel(),
  }
}

// The handle a test uses to push streamed events for the surface under test.
export interface Emit {
  enrollProgress: (event: EnrollProgressEvent) => void
  pluginProgress: (event: PluginProgressEvent) => void
  batchProgress: (push: BatchProgressPush) => void
  uploadProgress: (event: UploadProgressEvent) => void
  pluginLog: (event: PluginLogPush) => void
  printState: (event: PrintStateEvent) => void
  found: (printer: DiscoveredPrinterRecord) => void
  localAdded: (result: AddLocalResult) => void
  updateAvailable: (payload: UpdateAvailablePayload) => void
  upToDate: (version: string) => void
  downloadProgress: (percent: number) => void
  updateDownloaded: (version: string) => void
  updateError: (message: string) => void
}

function makeEmit(channels: Channels): Emit {
  return {
    enrollProgress: channels.enrollProgress.emit, pluginProgress: channels.pluginProgress.emit,
    batchProgress: channels.batchProgress.emit,
    uploadProgress: channels.uploadProgress.emit,
    pluginLog: channels.pluginLog.emit,
    printState: channels.printState.emit, found: channels.found.emit,
    localAdded: channels.localAdded.emit, updateAvailable: channels.updateAvailable.emit,
    upToDate: channels.upToDate.emit, downloadProgress: channels.downloadProgress.emit,
    updateDownloaded: channels.updateDownloaded.emit, updateError: channels.updateError.emit,
  }
}

function resolved<Value>(value: Value): () => Promise<Value> {
  return vi.fn().mockResolvedValue(value)
}

function voidFn(): () => Promise<void> {
  return vi.fn().mockResolvedValue(undefined)
}

function sub<Event>(channel: Channel<Event>): (callback: (event: Event) => void) => () => void {
  return vi.fn(channel.register)
}

const SETTINGS_DEFAULT = {
  pgpEnabled: false, clientId: 'test-client', workbenchLayout: 'A' as const,
  appUpdateFrequency: 'launch' as const, appUpdateAutoDownload: false, appUpdateInstallOnQuit: false,
  primaryReleaseChannel: 'stable' as const, disabledChannels: [] as ReleaseChannel[],
  verifySignatures: false,
}

function mockSettings(override: Partial<B3d['settings']> = {}): B3d['settings'] {
  return {
    get: resolved(SETTINGS_DEFAULT),
    set: vi.fn(async (patch) => ({ ...SETTINGS_DEFAULT, ...patch })),
    ...override,
  }
}

function mockAppUpdate(channels: Channels, override: Partial<B3d['appUpdate']> = {}): B3d['appUpdate'] {
  return {
    canAutoInstall: true,
    installNow: voidFn(), openDownload: voidFn(), checkNow: voidFn(), download: voidFn(),
    reconfigure: voidFn(), listReleases: resolved([]), rollback: resolved({ outcome: 'page' as const }),
    consumeApplied: resolved(null),
    onUpdateAvailable: sub(channels.updateAvailable), onUpToDate: sub(channels.upToDate),
    onDownloadProgress: sub(channels.downloadProgress), onUpdateDownloaded: sub(channels.updateDownloaded),
    onUpdateError: sub(channels.updateError), onOpenSettings: sub(channels.openSettings),
    ...override,
  }
}

function mockKeys(override: Partial<B3d['keys']> = {}): B3d['keys'] {
  return {
    list: resolved([]), generate: resolved(makeKey()), remove: voidFn(),
    export: resolved(''), exportPrivate: resolved(''), setDefault: voidFn(),
    setAssignments: voidFn(), setIcon: voidFn(), setPublishedAt: voidFn(),
    ...override,
  }
}

function mockPrinters(channels: Channels, override: Partial<B3d['printers']> = {}): B3d['printers'] {
  return {
    load: resolved([]), save: voidFn(), patch: voidFn(), remove: voidFn(), ping: resolved(true),
    checkSshOpen: resolved(true), checkWriteLayer: resolved(null), checkDaemon: resolved({ isManaged: false, reach: 'offline', sshOpen: false }),
    adapterGet: resolved(makeAdapterInfo()), adaptersList: resolved([makeAdapterInfo()]),
    checkSsh: resolved({ ok: true }), enroll: voidFn(), onEnrollProgress: sub(channels.enrollProgress),
    watchPrintState: voidFn(), unwatchPrintState: voidFn(), onPrintState: sub(channels.printState),
    deactivate: voidFn(), reactivate: voidFn(), uninstall: voidFn(), repair: voidFn(),
    updateDaemon: voidFn(), updateJinni: voidFn(), resetAccess: voidFn(),
    ...override,
  }
}

function mockAccess(override: Partial<B3d['access']> = {}): B3d['access'] {
  return {
    request: resolved({ ok: true }), status: resolved('granted' as const),
    clients: resolved({ clients: [], pending: [] }), grant: voidFn(), revoke: voidFn(),
    ...override,
  }
}

function mockStore(channels: Channels, override: Partial<B3d['store']> = {}): B3d['store'] {
  return {
    capabilities: resolved(makeCapabilities({})),
    install: resolved({ installedIds: [], log: makeInstallLog('plugin') }),
    uninstall: resolved([]),
    reconfigure: resolved({ installedIds: [], log: makeInstallLog('plugin') }),
    pluginConfig: resolved(null),
    recover: resolved({ ok: true, results: [] }), updateBatch: resolved({ ok: true, results: [] }),
    installBatch: resolved({ ok: true, results: [] }),
    uninstallBatch: resolved({ ok: true, results: [] }),
    onPluginProgress: sub(channels.pluginProgress),
    onBatchProgress: sub(channels.batchProgress),
    onUploadProgress: sub(channels.uploadProgress),
    watchPluginLog: voidFn(), unwatchPluginLog: voidFn(),
    pluginCaptures: resolved([] as string[]), onPluginLog: sub(channels.pluginLog),
    ...override,
  }
}

function mockRegistry(override: Partial<B3d['registry']> = {}): B3d['registry'] {
  return {
    catalog: resolved(makeCatalog([])),
    setSourceEnabled: resolved(makeCatalog([])),
    setChannelEnabled: resolved(SETTINGS_DEFAULT),
    assetInfo: resolved({ downloadCount: null, publishedAt: null }),
    ...override,
  }
}

function mockLocalStore(channels: Channels, override: Partial<B3d['localStore']> = {}): B3d['localStore'] {
  return {
    add: resolved({ added: [], errors: [] }), doc: resolved(null),
    removeContext: resolved({ printers: [], hasOtherSource: false }), remove: voidFn(),
    pathForFile: vi.fn(() => ''), onAdded: sub(channels.localAdded),
    ...override,
  }
}

function mockGitHost(override: Partial<B3d['gitHost']> = {}): B3d['gitHost'] {
  return {
    settings: resolved({ type: 'github' as const }), writeSettings: voidFn(),
    isConnected: resolved(false), storageEncrypted: resolved(true), getAccount: resolved(null),
    getTokenInfo: resolved({ type: 'device-flow' as const, scopes: ['repo'], expiresAt: null }),
    beginConnect: resolved({ type: 'device-flow' as const, userCode: 'ABCD-1234', verificationUrl: 'https://github.com/login/device', expiresAt: new Date(Date.now() + 600000) }),
    waitForAuth: voidFn(), disconnect: voidFn(),
    createRepo: resolved({ owner: 'tester', repo: 'demo', url: 'https://github.com/tester/demo', isNew: true }),
    listRepos: resolved([]), listOrgs: resolved([]), getFile: resolved(null), putFile: voidFn(),
    deleteFile: voidFn(), openPr: resolved({ number: 1, url: '' }),
    createRelease: resolved({ id: '1', tag: 'v1', name: 'v1', body: '', prerelease: false, publishedAt: null, url: '', assets: [] }),
    uploadAsset: resolved({ id: '1', name: 'asset', downloadUrl: '', downloadCount: 0 }),
    publishRelease: voidFn(), listReleases: resolved([]),
    ...override,
  }
}

function mockDevTools(override: Partial<B3d['devTools']> = {}): B3d['devTools'] {
  return {
    patch: {
      session: resolved({ patchId: 'patch', target: { id: 'target', name: 'target', content: '' }, hunks: [], analyses: [] }),
      apply: resolved(''),
    },
    ...override,
  }
}

export interface B3dHarness {
  b3d: B3d
  emit: Emit
}

export function makeB3dMock(overrides: B3dOverrides = {}): B3dHarness {
  var channels = makeChannels()
  var b3d: B3d = {
    platform: 'darwin', arch: 'arm64', daemonExpectedVersion: EXPECTED_DAEMON_VERSION,
    openUrl: voidFn(), onOpenAbout: sub(channels.openAbout), onB3dOpen: () => () => {},
    settings: mockSettings(overrides.settings), appUpdate: mockAppUpdate(channels, overrides.appUpdate),
    keys: mockKeys(overrides.keys), printers: mockPrinters(channels, overrides.printers),
    access: mockAccess(overrides.access), store: mockStore(channels, overrides.store),
    mdns: { start: voidFn(), stop: voidFn(), onFound: sub(channels.found), ...overrides.mdns },
    registry: mockRegistry(overrides.registry), localStore: mockLocalStore(channels, overrides.localStore),
    devTools: mockDevTools(overrides.devTools), gitHost: mockGitHost(overrides.gitHost),
  }

  return { b3d, emit: makeEmit(channels) }
}

export function installB3d(overrides: B3dOverrides = {}): B3dHarness {
  var harness = makeB3dMock(overrides)
  window.b3d = harness.b3d

  return harness
}
