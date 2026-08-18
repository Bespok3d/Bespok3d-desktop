// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BrowserWindow } from 'electron'

type IpcListener = (...args: unknown[]) => unknown

const registeredHandlers = new Map<string, IpcListener>()

function fakeHandle(channel: string, listener: IpcListener): void {
  if (registeredHandlers.has(channel)) {
    throw new Error(`Attempted to register a second handler for '${channel}'`)
  }
  registeredHandlers.set(channel, listener)
}

const syncChannels = new Map<string, IpcListener>()

function fakeOn(channel: string, listener: IpcListener): void {
  syncChannels.set(channel, listener)
}

const hoisted = vi.hoisted(() => ({ userDataDir: '' }))
vi.mock('electron', () => ({
  ipcMain: { handle: fakeHandle, on: fakeOn },
  shell: { openExternal: vi.fn() },
  app: { getPath: () => hoisted.userDataDir },
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('./enrollment', () => ({ checkSsh: vi.fn(), enrollPrinter: vi.fn() }))
vi.mock('./adapter-loader', () => ({ getAdapter: vi.fn(), listAdapters: vi.fn().mockReturnValue([]) }))
vi.mock('@adapters/snapmaker-u1/client/snapmaker-u1', () => ({ patchS90lmd: vi.fn() }))
vi.mock('./keys', () => ({
  generateKey: vi.fn(), listKeys: vi.fn(), removeKey: vi.fn(), exportPublicKey: vi.fn(),
  exportPrivateKey: vi.fn(), setDefault: vi.fn(), setAssignments: vi.fn(), setKeyIcon: vi.fn(), setPublishedAt: vi.fn(),
}))
vi.mock('./printers', () => ({
  savePrinter: vi.fn(), updatePrinter: vi.fn(), loadPrinters: vi.fn().mockReturnValue([]), removePrinter: vi.fn(),
  pingPrinter: vi.fn(), checkDaemon: vi.fn(), checkSshOpen: vi.fn(), resolveLiveAddress: vi.fn(),
}))
vi.mock('./daemon-client/expected-version', () => ({ expectedDaemonVersion: () => '0.0.0' }))
vi.mock('./mdns', () => ({ startMdnsScan: vi.fn(), stopMdnsScan: vi.fn() }))
vi.mock('./git-host', () => ({ activeConnector: vi.fn(), readSettings: vi.fn(), writeSettings: vi.fn() }))
// Exhaustive mock: every daemon-client export reachable through ipc's handler chain (store + access).
// The audit (sec 7) found this mock had silently drifted to miss reconfigure/updateBatch/uninstallBatch
// and the whole access surface; the behavioural handler tests below now fail if it drifts again.
vi.mock('./daemon-client/client', () => ({
  fetchCapabilities: vi.fn(), fetchDaemonStatus: vi.fn(), fetchSelfCheck: vi.fn(),
  installPlugin: vi.fn(), uninstallPlugin: vi.fn(), uninstallBatch: vi.fn(),
  reconfigurePlugin: vi.fn(), recoverPackages: vi.fn(), updateBatchPackages: vi.fn(),
  deactivateAll: vi.fn(), teardownDaemon: vi.fn(), setAddressResolver: vi.fn(),
  requestAccess: vi.fn(), fetchAccessClients: vi.fn(), grantAccess: vi.fn(), revokeAccess: vi.fn(), isAccessGranted: vi.fn(),
}))
vi.mock('./settings', () => ({
  loadSettings: vi.fn().mockReturnValue({ pgpEnabled: false, clientId: 'c' }),
  saveSettings: vi.fn(), clientId: vi.fn().mockReturnValue('c'),
}))
vi.mock('./ssh', () => ({ connect: vi.fn(), shellQuote: (value: string) => `'${value}'` }))
vi.mock('./dev-tools/patch-engine', () => ({ buildSession: vi.fn() }))
vi.mock('./dev-tools/patch-apply', () => ({ applyPatch: vi.fn() }))

import { registerIpc } from './ipc'
import { fetchDaemonStatus, fetchCapabilities, fetchSelfCheck, reconfigurePlugin, fetchAccessClients, grantAccess, revokeAccess } from './daemon-client/client'
import { enrollPrinter } from './enrollment'
import { updatePrinter, loadPrinters, checkDaemon } from './printers'
import { getAdapter } from './adapter-loader'
import { connect } from './ssh'
import { startMdnsScan } from './mdns'

const mockStartMdnsScan = vi.mocked(startMdnsScan)

const firstWindow = { id: 'first' } as unknown as BrowserWindow
const respawnedWindow = { id: 'respawned' } as unknown as BrowserWindow

describe('registerIpc', () => {
  beforeEach(() => {
    registeredHandlers.clear()
    mockStartMdnsScan.mockClear()
  })

  it('registers every channel exactly once', () => {
    expect(() => registerIpc(() => firstWindow)).not.toThrow()
    expect(registeredHandlers.has('shell:openUrl')).toBe(true)
    expect(registeredHandlers.has('mdns:start')).toBe(true)
  })

  it('exposes update-daemon as its own operation, not a slice of enrollment', () => {
    registerIpc(() => firstWindow)
    expect(registeredHandlers.has('printer:update-daemon')).toBe(true)
  })

  it('registers the multi-client access channels and the auth reset', () => {
    registerIpc(() => firstWindow)
    const channels = ['access:request', 'access:status', 'access:clients', 'access:grant', 'access:revoke', 'printer:reset-access', 'settings:get', 'settings:set']
    channels.forEach((channel) => expect(registeredHandlers.has(channel)).toBe(true))
  })

  it('targets the current window so a respawned window receives events', () => {
    var currentWindow = firstWindow
    registerIpc(() => currentWindow)
    const mdnsStartHandler = registeredHandlers.get('mdns:start')
    if (!mdnsStartHandler) throw new Error('mdns:start handler not registered')

    mdnsStartHandler()
    expect(mockStartMdnsScan).toHaveBeenLastCalledWith(firstWindow)

    currentWindow = respawnedWindow
    mdnsStartHandler()
    expect(mockStartMdnsScan).toHaveBeenLastCalledWith(respawnedWindow)
  })
})

describe('enroll handler refreshes the record', () => {
  beforeEach(() => registeredHandlers.clear())

  it('records the true daemon version on a successful enroll, not a version-less window', async () => {
    // Enrollment used to leave the record without a daemonVersion until the first ping. The handler
    // now refreshes the record from the live daemon as soon as enroll succeeds, so the printer shows
    // its real version (and update signal) immediately.
    vi.mocked(enrollPrinter).mockResolvedValue(undefined)
    vi.mocked(checkDaemon).mockResolvedValue(true)
    vi.mocked(loadPrinters).mockReturnValue([
      { id: 'printer-1', ip: '10.0.0.5', daemonToken: 'T', daemonCert: 'C' } as never,
    ])
    vi.mocked(fetchDaemonStatus).mockResolvedValue({ ok: true, version: '0.0.0' })
    vi.mocked(fetchCapabilities).mockResolvedValue({ installed: {}, endpoints: [] } as never)
    vi.mocked(fetchSelfCheck).mockResolvedValue({ ok: true, drift: [] })

    registerIpc(() => firstWindow)
    const enroll = registeredHandlers.get('printers:enroll')
    if (!enroll) throw new Error('printers:enroll handler not registered')
    await enroll({}, 'printer-1', '10.0.0.5', 'snapmaker-u1', 'lava', 'pw', 22)

    expect(updatePrinter).toHaveBeenCalledWith(
      'printer-1',
      expect.objectContaining({ daemonVersion: '0.0.0', daemonUpdateAvailable: false }),
    )
  })
})

const writeLayerDefaults = { sshUser: 'root', sshPasswordHint: 'snapmaker', sshPort: 22, runtimeUser: 'lava' }
const enrolledWriteLayerRecord = { id: 'printer-1', adapter: 'snapmaker-u1', ip: '10.0.0.5', enrollmentLog: { steps: [] } }

function writeLayerAdapter(intact: boolean) {
  return { defaults: writeLayerDefaults, verifyEnrolled: vi.fn(() => Promise.resolve(intact)) } as never
}

function invokeCheckWriteLayer(): Promise<boolean | null> {
  registerIpc(() => firstWindow)
  const handler = registeredHandlers.get('printers:checkWriteLayer')
  if (!handler) throw new Error('printers:checkWriteLayer handler not registered')

  return handler({}, 'printer-1') as Promise<boolean | null>
}

describe('printers:checkWriteLayer handler (repair vs recover)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registeredHandlers.clear()
    vi.mocked(connect).mockResolvedValue({ close: vi.fn() } as never)
  })

  // The verdict is a live measurement of the printer, not a property of it: a printer can be reflashed
  // while the app is closed, and a saved "the write layer is fine" came back at the next start as if it
  // had just been taken, so Repair was offered forever on a printer only full recovery can rebuild.
  it('answers the verdict without saving it on the record', async () => {
    vi.mocked(loadPrinters).mockReturnValue([enrolledWriteLayerRecord as never])
    vi.mocked(getAdapter).mockReturnValue(writeLayerAdapter(false))
    expect(await invokeCheckWriteLayer()).toBe(false)
    expect(updatePrinter).not.toHaveBeenCalled()
  })

  it('returns null for a custom-credential printer without probing', async () => {
    vi.mocked(loadPrinters).mockReturnValue([{ ...enrolledWriteLayerRecord, customSshCredentials: true } as never])
    vi.mocked(getAdapter).mockReturnValue(writeLayerAdapter(true))
    expect(await invokeCheckWriteLayer()).toBeNull()
    expect(connect).not.toHaveBeenCalled()
  })

  it('returns null for a never-enrolled printer', async () => {
    vi.mocked(loadPrinters).mockReturnValue([{ id: 'printer-1', adapter: 'snapmaker-u1', ip: '10.0.0.5' } as never])
    expect(await invokeCheckWriteLayer()).toBeNull()
    expect(connect).not.toHaveBeenCalled()
  })

  it('returns null (degrades to the Repair backstop) when the SSH connect fails', async () => {
    vi.mocked(loadPrinters).mockReturnValue([enrolledWriteLayerRecord as never])
    vi.mocked(getAdapter).mockReturnValue(writeLayerAdapter(true))
    vi.mocked(connect).mockRejectedValue(new Error('connection refused'))
    expect(await invokeCheckWriteLayer()).toBeNull()
  })
})

// Guards the mock-rot the audit flagged (sec 7): ipc's handler chain imports daemon-client functions
// (reconfigure / access*) that the './daemon/client' mock used to omit. Nothing invoked them, so the
// gap was invisible. These invoke each one through its registered handler, so an incomplete mock makes
// the call throw "X is not a function" and the test fails - the gap can no longer hide.
describe('store + access handlers reach their daemon-client calls', () => {
  const managed = { id: 'printer-1', ip: '10.0.0.5', daemonToken: 'T', daemonCert: 'C' }
  const progressWindow = { webContents: { send: vi.fn() }, isDestroyed: () => false } as unknown as BrowserWindow

  beforeEach(() => {
    vi.clearAllMocks()
    registeredHandlers.clear()
    vi.mocked(loadPrinters).mockReturnValue([managed as never])
    vi.mocked(fetchCapabilities).mockResolvedValue({ installed: {}, endpoints: [] } as never)
  })

  function handlerFor(channel: string) {
    registerIpc(() => progressWindow)
    const handler = registeredHandlers.get(channel)
    if (!handler) throw new Error(`${channel} handler not registered`)

    return handler
  }

  it('store:reconfigure calls reconfigurePlugin', async () => {
    vi.mocked(reconfigurePlugin).mockResolvedValue({ pluginId: 'spoolman', timestamp: 1, ok: true, phases: [] })
    await handlerFor('store:reconfigure')({}, 'printer-1', 'spoolman', { MODE: 'on' })
    expect(reconfigurePlugin).toHaveBeenCalledWith(managed, 'spoolman', { MODE: 'on' })
  })

  it('access:clients calls fetchAccessClients', async () => {
    vi.mocked(fetchAccessClients).mockResolvedValue({ clients: [] } as never)
    await handlerFor('access:clients')({}, 'printer-1')
    expect(fetchAccessClients).toHaveBeenCalledWith(managed)
  })

  it('access:grant calls grantAccess with the identity', async () => {
    vi.mocked(grantAccess).mockResolvedValue(undefined)
    await handlerFor('access:grant')({}, 'printer-1', 'FP:abc')
    expect(grantAccess).toHaveBeenCalledWith(managed, 'FP:abc')
  })

  it('access:revoke calls revokeAccess with the identity', async () => {
    vi.mocked(revokeAccess).mockResolvedValue(undefined)
    await handlerFor('access:revoke')({}, 'printer-1', 'FP:abc')
    expect(revokeAccess).toHaveBeenCalledWith(managed, 'FP:abc')
  })
})
