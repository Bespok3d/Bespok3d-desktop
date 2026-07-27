import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdmZip from 'adm-zip'
import type { BrowserWindow } from 'electron'
import type { MergedEntry } from '../registry/model'
import type { RecoverResult } from '@bespok3d/contract'

vi.mock('electron', () => ({ app: { getPath: () => '' } }))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('../printers', () => ({ updatePrinter: vi.fn() }))
vi.mock('../registry', () => ({ loadCatalog: vi.fn() }))
vi.mock('./catalog-archive', () => ({ findCatalogEntry: vi.fn(), resolveArchiveBytes: vi.fn(), discardCachedArchive: vi.fn() }))
vi.mock('./batch-progress', () => ({ streamBatchProgress: vi.fn() }))
vi.mock('./progress', () => ({ sendUpload: vi.fn() }))
vi.mock('./record-sync', () => ({ capsOrFallback: vi.fn() }))
// The real DaemonHttpError comes through the mock, so a refusal built here is the same class the
// guard tests with instanceof: a hand-mirrored fake would drift the day the daemon adds a field.
vi.mock('../daemon-client/client', async () => {
  const { DaemonHttpError } = await vi.importActual<typeof import('../daemon-client/transport')>('../daemon-client/transport')

  return { DaemonHttpError, fetchCapabilities: vi.fn(), updateBatchPackages: vi.fn(), installBatchPackages: vi.fn() }
})
vi.mock('../daemon-client/status', () => ({ getManagedRecord: vi.fn(), parseCaps: () => ({ installedIds: [] }) }))

import { orderedBatchPluginIds, runStoreUpdateBatch, runStoreInstallBatch } from './update-batch'
import { loadCatalog } from '../registry'
import { updatePrinter } from '../printers'
import type { PrinterRecord } from '../printers'
import { findCatalogEntry, resolveArchiveBytes, discardCachedArchive } from './catalog-archive'
import { streamBatchProgress } from './batch-progress'
import { capsOrFallback } from './record-sync'
import { DaemonHttpError, fetchCapabilities, updateBatchPackages, installBatchPackages } from '../daemon-client/client'
import { getManagedRecord } from '../daemon-client/status'

const LISTED_ENTRY = { name: 'idle-timeout', version: '0.2.0', trust: 'project', signer: null, registry_url: '/registry/index.json', channel: 'stable' } as MergedEntry
const CAMERA_ENTRY = { ...LISTED_ENTRY, name: 'camera', version: '0.4.0' } as MergedEntry
const SPOOLMAN_ENTRY = { ...LISTED_ENTRY, name: 'spoolman', version: '0.1.29' } as MergedEntry

const HONEST_MANIFEST = {
  name: 'idle-timeout',
  version: '0.2.0',
  install: { config: { 'main.cfg': 'config/main.cfg' } },
  files: [{ path: 'config/main.cfg', sha256: 'f'.repeat(64) }],
}

function packageWith(manifest: Record<string, unknown>): Buffer {
  const archive = new AdmZip()
  archive.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'))
  archive.addFile('config/main.cfg', Buffer.from('# obviously fake payload\n', 'utf8'))

  return archive.toBuffer()
}

// The printer answers with one row per package it was sent, so the default stub answers for the one
// package these cases send. A row per plugin is what tells the app which plugins actually installed.
const IDLE_TIMEOUT_INSTALLED = { ok: true, results: [{ pluginId: 'idle-timeout', ok: true, skipped: false, reason: '', log: [] }] }

function stubTheBatchAround(archiveBytes: Buffer): void {
  vi.mocked(getManagedRecord).mockReturnValue({ id: 'printer-1', ip: '203.0.113.7' } as never)
  vi.mocked(loadCatalog).mockResolvedValue({ plugins: [LISTED_ENTRY] } as never)
  vi.mocked(findCatalogEntry).mockReturnValue(LISTED_ENTRY)
  vi.mocked(resolveArchiveBytes).mockResolvedValue(archiveBytes)
  vi.mocked(fetchCapabilities).mockResolvedValue({} as never)
  vi.mocked(streamBatchProgress).mockResolvedValue(() => undefined)
  vi.mocked(updateBatchPackages).mockResolvedValue(IDLE_TIMEOUT_INSTALLED as never)
  vi.mocked(installBatchPackages).mockResolvedValue(IDLE_TIMEOUT_INSTALLED as never)
  vi.mocked(capsOrFallback).mockResolvedValue({ installedIds: ['idle-timeout'] } as never)
}

const ONE_SPEC = [{ pluginId: 'idle-timeout' }]

function updateBatch(): Promise<RecoverResult> {
  return runStoreUpdateBatch({} as BrowserWindow, 'printer-1', ONE_SPEC)
}

describe('orderedBatchPluginIds', () => {
  it('places a still-missing dependency before the plugin that needs it', () => {
    const updates = [{ pluginId: 'force-bed-mesh', depIds: ['print-prefs-core'] }]
    expect(orderedBatchPluginIds(updates, [])).toEqual(['print-prefs-core', 'force-bed-mesh'])
  })

  it('skips a dependency that is already installed', () => {
    const updates = [{ pluginId: 'force-bed-mesh', depIds: ['print-prefs-core'] }]
    expect(orderedBatchPluginIds(updates, ['print-prefs-core'])).toEqual(['force-bed-mesh'])
  })

  it('dedupes a dependency shared by several updated plugins', () => {
    const updates = [
      { pluginId: 'force-bed-mesh', depIds: ['print-prefs-core'] },
      { pluginId: 'force-timelapse', depIds: ['print-prefs-core'] },
    ]
    expect(orderedBatchPluginIds(updates, [])).toEqual(['print-prefs-core', 'force-bed-mesh', 'force-timelapse'])
  })

  it('returns just the plugin when it has no deps', () => {
    expect(orderedBatchPluginIds([{ pluginId: 'cpu-temp' }], [])).toEqual(['cpu-temp'])
  })
})

// A batch is one daemon call carrying several packages, so it is a SECOND way bytes reach the printer
// and it has to face the same verification as a single install. These cases exist because it did not:
// "Install selected" and "Update all" both routed around the check while the single-install button
// refused the identical archive.
describe('store batch package verification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not send an update package that names a different plugin, and says why', async () => {
    stubTheBatchAround(packageWith({ ...HONEST_MANIFEST, name: 'camera' }))
    const result = await updateBatch()
    expect(updateBatchPackages).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    expect(result.results[0].reason).toMatch(/contains plugin "camera"/)
  })

  it('does not send an update package below the listed version, and says why', async () => {
    stubTheBatchAround(packageWith({ ...HONEST_MANIFEST, version: '0.1.9' }))
    const result = await updateBatch()
    expect(updateBatchPackages).not.toHaveBeenCalled()
    expect(result.results[0].reason).toMatch(/older than the listed/)
  })

  it('refuses an install-batch package on the same terms as a single install', async () => {
    stubTheBatchAround(packageWith({ ...HONEST_MANIFEST, name: 'camera' }))
    const result = await runStoreInstallBatch({} as BrowserWindow, 'printer-1', ONE_SPEC)
    expect(installBatchPackages).not.toHaveBeenCalled()
    expect(result.results[0]).toMatchObject({ pluginId: 'idle-timeout', ok: false, skipped: true })
  })

  it('posts a batch whose packages verify', async () => {
    stubTheBatchAround(packageWith(HONEST_MANIFEST))
    await updateBatch()
    expect(updateBatchPackages).toHaveBeenCalled()
  })
})

// A batch is a convenience button for installing these plugins one by one, so the result has to be the
// same as installing them one by one: a refused package costs its own plugin, and any plugin that needs
// it, and NOTHING else. The plugins left behind are reported at the end with the reason each was left.
function stubBatchWhereOnePackageIsRefused(refusedName: string): void {
  stubTheBatchAround(packageWith(HONEST_MANIFEST))
  const byName = new Map([LISTED_ENTRY, CAMERA_ENTRY, SPOOLMAN_ENTRY].map((entry) => [entry.name, entry]))
  vi.mocked(findCatalogEntry).mockImplementation((_plugins, pluginId) => byName.get(pluginId) as MergedEntry)
  vi.mocked(resolveArchiveBytes).mockImplementation((entry) =>
    Promise.resolve(packageWith({ ...HONEST_MANIFEST, name: entry.name === refusedName ? 'a-different-plugin' : entry.name, version: entry.version })),
  )
}

function pluginIdsSentToThePrinter(): string[] {
  const [firstCall] = vi.mocked(updateBatchPackages).mock.calls

  return (firstCall?.[1] ?? []).map((sent) => sent.pluginId)
}

function reasonFor(result: RecoverResult, pluginId: string): string {
  return result.results.find((row) => row.pluginId === pluginId)?.reason ?? ''
}

describe('store batch installs the plugins it can and reports the ones it cannot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('installs the other plugins when one package is refused, and names the refused one', async () => {
    stubBatchWhereOnePackageIsRefused('camera')
    const specs = [{ pluginId: 'idle-timeout' }, { pluginId: 'camera' }, { pluginId: 'spoolman' }]
    const result = await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', specs)
    expect(pluginIdsSentToThePrinter()).toEqual(['idle-timeout', 'spoolman'])
    expect(result.ok).toBe(false)
    expect(reasonFor(result, 'camera')).toMatch(/served for "camera" contains plugin "a-different-plugin"/)
  })

  it('also leaves out the plugin that needed the refused one, saying which plugin is missing', async () => {
    stubBatchWhereOnePackageIsRefused('spoolman')
    const specs = [{ pluginId: 'idle-timeout' }, { pluginId: 'camera', depIds: ['spoolman'] }]
    const result = await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', specs)
    expect(pluginIdsSentToThePrinter()).toEqual(['idle-timeout'])
    expect(reasonFor(result, 'spoolman')).toMatch(/served for "spoolman" contains plugin "a-different-plugin"/)
    expect(reasonFor(result, 'camera')).toMatch(/because "spoolman", which it needs, was not installed/)
  })

  it('sends nothing to the printer when every package in the batch is refused', async () => {
    stubTheBatchAround(packageWith({ ...HONEST_MANIFEST, name: 'a-different-plugin' }))
    const specs = [{ pluginId: 'idle-timeout' }, { pluginId: 'camera' }]
    const result = await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', specs)
    expect(updateBatchPackages).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    expect(result.results.map((row) => row.pluginId)).toEqual(['idle-timeout', 'camera'])
  })

  // A plugin the app cannot even fetch is the same to the batch as a refused one: its own row, and the
  // plugins that do not depend on it still install.
  it('installs the rest when one plugin is not in the catalog at all', async () => {
    stubTheBatchAround(packageWith(HONEST_MANIFEST))
    vi.mocked(findCatalogEntry).mockImplementation((_plugins, pluginId) => {
      if (pluginId !== LISTED_ENTRY.name) throw new Error(`bundled plugin not found: ${pluginId}`)

      return LISTED_ENTRY
    })

    const result = await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', [{ pluginId: 'idle-timeout' }, { pluginId: 'ghost-plugin' }])
    expect(pluginIdsSentToThePrinter()).toEqual(['idle-timeout'])
    expect(reasonFor(result, 'ghost-plugin')).toMatch(/bundled plugin not found/)
  })
})

describe('store batch report', () => {
  beforeEach(() => vi.clearAllMocks())

  // The batch also carries dependencies the user never picked. Once the plugin they were added for is
  // left out, sending them alone installs something nobody asked for.
  it('does not send a dependency it only added for a plugin that was left out', async () => {
    stubBatchWhereOnePackageIsRefused('spoolman')
    const specs = [{ pluginId: 'camera', depIds: ['idle-timeout', 'spoolman'] }]
    const result = await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', specs)
    expect(updateBatchPackages).not.toHaveBeenCalled()
    expect(reasonFor(result, 'camera')).toMatch(/because "spoolman", which it needs, was not installed/)
  })

  // The plugin that needs the refused one is left out, and so is the plugin that needs THAT one: a
  // chain two deep must not put a plugin on the printer whose dependency's dependency never arrived.
  it('follows the chain of plugins waiting on the refused one, however deep it runs', async () => {
    stubBatchWhereOnePackageIsRefused('spoolman')
    const specs = [{ pluginId: 'spoolman' }, { pluginId: 'camera', depIds: ['spoolman'] }, { pluginId: 'idle-timeout', depIds: ['camera'] }]
    const result = await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', specs)
    expect(updateBatchPackages).not.toHaveBeenCalled()
    expect(reasonFor(result, 'idle-timeout')).toMatch(/because "camera", which it needs, was not installed/)
  })

  it('reports what the printer said about the plugins it installed alongside the ones it left out', async () => {
    stubBatchWhereOnePackageIsRefused('camera')
    vi.mocked(updateBatchPackages).mockResolvedValue({ ok: true, results: [{ pluginId: 'idle-timeout', ok: true, skipped: false, reason: '', log: [] }] } as never)
    const result = await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', [{ pluginId: 'idle-timeout' }, { pluginId: 'camera' }])
    expect(result.results.map((row) => `${row.pluginId}:${row.ok}`)).toEqual(['idle-timeout:true', 'camera:false'])
    expect(result.ok).toBe(false)
  })
})

// Installing several plugins at once is a convenience button for installing them one by one, so a
// plugin that did not install has to leave the printer record in the same state it would have left
// installing alone: its attempt kept until it installs, and its downloaded package thrown away.
function recordAfterTheBatch(before: Partial<PrinterRecord> = {}): PrinterRecord {
  function applyPatch(current: PrinterRecord, [, patch]: Parameters<typeof updatePrinter>): PrinterRecord {
    return { ...current, ...(typeof patch === 'function' ? patch(current) : patch) }
  }

  return vi.mocked(updatePrinter).mock.calls.reduce(applyPatch, { id: 'printer-1', ...before } as PrinterRecord)
}

const CAMERA_REFUSED = [{ pluginId: 'idle-timeout' }, { pluginId: 'camera' }]

describe('what a batch leaves behind for a plugin that did not install', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps why a refused plugin did not install, alongside the plugins that did', async () => {
    stubBatchWhereOnePackageIsRefused('camera')
    await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', CAMERA_REFUSED)
    const kept = recordAfterTheBatch().failedInstallLogs ?? {}
    expect(Object.keys(kept)).toEqual(['camera'])
    expect(kept.camera.phases[0].items[0].output).toMatch(/contains plugin "a-different-plugin"/)
  })

  it('keeps why each plugin did not install even when the printer was never called', async () => {
    stubTheBatchAround(packageWith({ ...HONEST_MANIFEST, name: 'a-different-plugin' }))
    await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', CAMERA_REFUSED)
    expect(updateBatchPackages).not.toHaveBeenCalled()
    expect(Object.keys(recordAfterTheBatch().failedInstallLogs ?? {})).toEqual(['idle-timeout', 'camera'])
  })

  it('keeps how far the printer got with a plugin it could not install', async () => {
    stubTheBatchAround(packageWith(HONEST_MANIFEST))
    const phases = [{ id: 'apply', label: 'Apply', ok: false, items: [{ label: 'start service', ok: false, output: 'exit 1' }] }]
    vi.mocked(updateBatchPackages).mockResolvedValue({ ok: false, results: [{ pluginId: 'idle-timeout', ok: false, skipped: false, reason: 'service down', log: phases }] } as never)
    await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', ONE_SPEC)
    expect(recordAfterTheBatch().failedInstallLogs?.['idle-timeout'].phases).toEqual(phases)
  })

  it('throws away the downloaded copy of the package it refused', async () => {
    stubBatchWhereOnePackageIsRefused('camera')
    await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', CAMERA_REFUSED)
    expect(vi.mocked(discardCachedArchive).mock.calls.map(([entry]) => entry.name)).toEqual(['camera'])
  })

  it('forgets an earlier failure of a plugin this batch installed', async () => {
    stubTheBatchAround(packageWith(HONEST_MANIFEST))
    const earlier = { 'idle-timeout': { pluginId: 'idle-timeout', timestamp: 1, ok: false, phases: [] } }
    await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', ONE_SPEC)
    expect(recordAfterTheBatch({ failedInstallLogs: earlier }).failedInstallLogs).toEqual({})
  })
})

const EARLIER_CAMERA_FAILURE = { camera: { pluginId: 'camera', timestamp: 1, ok: false, phases: [] } }

describe('what a batch keeps about plugins it did not touch', () => {
  beforeEach(() => vi.clearAllMocks())

  // A plugin whose UPDATE was refused is still installed on the printer, so being installed cannot be
  // what clears its reason: only installing here does. Otherwise the next batch wipes the explanation.
  it('keeps why an earlier update was refused for a plugin this batch never touched', async () => {
    stubTheBatchAround(packageWith(HONEST_MANIFEST))
    vi.mocked(capsOrFallback).mockResolvedValue({ installedIds: ['idle-timeout', 'camera'] } as never)
    await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', ONE_SPEC)
    expect(Object.keys(recordAfterTheBatch({ failedInstallLogs: EARLIER_CAMERA_FAILURE }).failedInstallLogs ?? {})).toEqual(['camera'])
  })

  // The printer reports the one restart of the services the batch's plugins share as its own row. It is
  // not a plugin, so it must never end up filed as a plugin that failed and can never install.
  it('does not file the shared service restart as a plugin that did not install', async () => {
    stubTheBatchAround(packageWith(HONEST_MANIFEST))
    const services = { pluginId: '(services)', ok: false, skipped: false, reason: 'restart failed', log: [] }
    vi.mocked(updateBatchPackages).mockResolvedValue({ ok: false, results: [...IDLE_TIMEOUT_INSTALLED.results, services] } as never)
    await runStoreUpdateBatch({} as BrowserWindow, 'printer-1', ONE_SPEC)
    expect(recordAfterTheBatch().failedInstallLogs).toEqual({})
  })

  // The refusals are already true before the printer is called at all, so a printer that then refuses
  // the call (busy printing, off the network) must not take them down with it.
  it('keeps why a plugin was refused even when the call to the printer then fails', async () => {
    stubBatchWhereOnePackageIsRefused('camera')
    vi.mocked(updateBatchPackages).mockRejectedValue(new Error('the printer is busy printing'))
    await expect(runStoreUpdateBatch({} as BrowserWindow, 'printer-1', CAMERA_REFUSED)).rejects.toThrow(/busy printing/)
    expect(Object.keys(recordAfterTheBatch().failedInstallLogs ?? {})).toContain('camera')
  })
})

// Installing these one at a time, every one of them would have kept what the printer said. A batch that
// dies on "printer is busy" must leave exactly the same behind for every plugin it had sent.
describe('what a batch leaves behind when the printer refuses the call itself', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps what the printer said as the reason for each plugin it had sent', async () => {
    stubBatchWhereOnePackageIsRefused('camera')
    vi.mocked(updateBatchPackages).mockRejectedValue(new Error('the printer is busy printing'))
    await expect(runStoreUpdateBatch({} as BrowserWindow, 'printer-1', CAMERA_REFUSED)).rejects.toThrow(/busy printing/)
    const kept = recordAfterTheBatch().failedInstallLogs ?? {}
    expect(Object.keys(kept)).toEqual(['camera', 'idle-timeout'])
    expect(kept['idle-timeout'].phases[0].items[0].output).toMatch(/busy printing/)
  })
})

// A print in progress is the one refusal the user hits by accident, and both batches must say the
// same thing about it: "Update all" while printing reads like "Install selected" while printing, not
// like a raw daemon 4xx. The sentence is the only thing the user gets, so it has to be a sentence.
describe('a printer that refuses the batch because it is printing', () => {
  beforeEach(() => vi.clearAllMocks())

  function printingRefusal(): DaemonHttpError {
    return new DaemonHttpError(409, { error: 'blocked', blocked_actions: ['restart-klipper', 'restart-moonraker'] }, 'daemon 409: {"error":"blocked"}')
  }

  const IN_PLAIN_WORDS = 'The printer is busy: this would restart Klipper, Moonraker, interrupting the print. Try again when it is idle.'

  it('says so in plain words when updating', async () => {
    stubTheBatchAround(packageWith(HONEST_MANIFEST))
    vi.mocked(updateBatchPackages).mockRejectedValue(printingRefusal())
    await expect(updateBatch()).rejects.toThrow(IN_PLAIN_WORDS)
  })

  it('says so in plain words when installing', async () => {
    stubTheBatchAround(packageWith(HONEST_MANIFEST))
    vi.mocked(installBatchPackages).mockRejectedValue(printingRefusal())
    await expect(runStoreInstallBatch({} as BrowserWindow, 'printer-1', ONE_SPEC)).rejects.toThrow(IN_PLAIN_WORDS)
  })

  it('keeps that sentence as the reason each plugin did not install', async () => {
    stubTheBatchAround(packageWith(HONEST_MANIFEST))
    vi.mocked(updateBatchPackages).mockRejectedValue(printingRefusal())
    await expect(updateBatch()).rejects.toThrow(IN_PLAIN_WORDS)
    expect(recordAfterTheBatch().failedInstallLogs?.['idle-timeout'].phases[0].items[0].output).toContain('Try again when it is idle.')
  })
})
