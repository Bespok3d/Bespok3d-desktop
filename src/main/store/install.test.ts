// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdmZip from 'adm-zip'
import * as openpgp from 'openpgp'
import type { BrowserWindow } from 'electron'
import type { MergedEntry } from '../registry/model'
import type { PrinterRecord } from '../printers'

vi.mock('../printers', () => ({ updatePrinter: vi.fn() }))
vi.mock('../registry', () => ({ loadCatalog: vi.fn() }))
vi.mock('./catalog-archive', () => ({ findCatalogVariant: vi.fn(), resolveArchiveBytes: vi.fn(), discardCachedArchive: vi.fn() }))
vi.mock('./progress', () => ({ sendProgress: vi.fn(), sendUpload: vi.fn() }))
vi.mock('./record-sync', () => ({ capsAfterInstall: vi.fn(), recordAppliedVars: () => ({}) }))
vi.mock('../daemon-client/client', () => ({ fetchCapabilities: vi.fn(), installPlugin: vi.fn() }))
vi.mock('../daemon-client/status', () => ({ getManagedRecord: vi.fn(), parseCaps: () => ({ installedIds: [] }) }))
vi.mock('../daemon-client/feeds/install-progress', () => ({ watchInstallProgress: vi.fn(), installPhaseMessage: (phase: string) => phase }))
vi.mock('../daemon-client/guard', () => ({ daemonGuardMessage: vi.fn() }))
vi.mock('../registry/resolve/latest-release', () => ({ fetchLatestRelease: vi.fn() }))

import { installGuarded } from './install'
import { fetchLatestRelease } from '../registry/resolve/latest-release'
import { updatePrinter } from '../printers'
import { loadCatalog } from '../registry'
import { findCatalogVariant, resolveArchiveBytes, discardCachedArchive } from './catalog-archive'
import { capsAfterInstall } from './record-sync'
import { fetchCapabilities, installPlugin } from '../daemon-client/client'
import { getManagedRecord } from '../daemon-client/status'
import { watchInstallProgress } from '../daemon-client/feeds/install-progress'
import { daemonGuardMessage } from '../daemon-client/guard'
import { malformedPackageMessage } from './malformed-package'

const LISTED_ENTRY: MergedEntry = {
  name: 'idle-timeout',
  version: '0.2.0',
  trust: 'project',
  signer: null,
  registry_url: '/registry/index.json',
  channel: 'stable',
}

function packageWith(manifest: Record<string, unknown>): Buffer {
  const archive = new AdmZip()
  archive.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'))
  archive.addFile('config/main.cfg', Buffer.from('# obviously fake payload\n', 'utf8'))

  return archive.toBuffer()
}

const HONEST_MANIFEST = {
  name: 'idle-timeout',
  version: '0.2.0',
  install: { config: { 'main.cfg': 'config/main.cfg' } },
  files: [{ path: 'config/main.cfg', sha256: 'f'.repeat(64) }],
}

function stubTheHappyPathAround(archiveBytes: Buffer): void {
  vi.mocked(getManagedRecord).mockReturnValue({ id: 'printer-1', ip: '203.0.113.7' } as never)
  vi.mocked(loadCatalog).mockResolvedValue({ plugins: [LISTED_ENTRY] } as never)
  vi.mocked(findCatalogVariant).mockReturnValue(LISTED_ENTRY)
  vi.mocked(resolveArchiveBytes).mockResolvedValue(archiveBytes)
  vi.mocked(fetchCapabilities).mockResolvedValue({} as never)
  vi.mocked(watchInstallProgress).mockResolvedValue(() => undefined)
  vi.mocked(installPlugin).mockResolvedValue({ steps: [] } as never)
  vi.mocked(capsAfterInstall).mockResolvedValue({ installedIds: ['idle-timeout'] } as never)
}

function install(): Promise<unknown> {
  return installGuarded({} as BrowserWindow, 'printer-1', 'idle-timeout')
}

const DEP_ID = 'print-prefs-core'

// A dependency is resolved and uploaded by a code path of its own inside the same install, so the two
// archives have to be told apart: the stub answers per plugin id rather than handing back one buffer.
function stubADependencyResolvingTo(depArchive: Buffer, mainArchive: Buffer): void {
  stubTheHappyPathAround(mainArchive)
  vi.mocked(findCatalogVariant).mockImplementation((_catalog, pluginId) => ({ ...LISTED_ENTRY, name: pluginId }))
  vi.mocked(resolveArchiveBytes).mockImplementation((entry) => Promise.resolve(entry.name === DEP_ID ? depArchive : mainArchive))
}

function installWithDependency(): Promise<unknown> {
  return installGuarded({} as BrowserWindow, 'printer-1', 'idle-timeout', undefined, [DEP_ID])
}

// Signed by a key generated here and thrown away, so it is by construction NOT in the anchor set the
// app ships. Its only job is to be a well-formed signature that must still be refused.
async function signedByAStranger(manifest: Record<string, unknown>): Promise<Buffer> {
  const generated = await openpgp.generateKey({ userIDs: [{ name: 'Stranger', email: 'stranger@example.invalid' }], format: 'object' })
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  const message = await openpgp.createMessage({ binary: manifestBytes })
  const armored = await openpgp.sign({ message, signingKeys: generated.privateKey, detached: true })
  const archive = new AdmZip()
  archive.addFile('manifest.json', manifestBytes)
  archive.addFile('manifest.json.sig', Buffer.from(armored as string, 'utf8'))
  archive.addFile('config/main.cfg', Buffer.from('# obviously fake payload\n', 'utf8'))

  return archive.toBuffer()
}

// updatePrinter takes either a plain patch or an updater; the install path must use the updater form
// so a status ping that landed mid-install is merged rather than clobbered, and the assertion below
// only means anything once that form is confirmed.
function patchAppliedToRecord(patch: Parameters<typeof updatePrinter>[1], before: Partial<PrinterRecord> = {}): Partial<PrinterRecord> {
  if (typeof patch !== 'function') throw new Error('install must patch the printer record through an updater function')

  return patch(before as PrinterRecord)
}

describe('runStoreInstall package verification', () => {
  beforeEach(() => vi.clearAllMocks())

  // The check sits after resolveArchiveBytes rather than inside it, so it covers all three ways the
  // bytes can arrive. This is the cache-hit case: bytes read straight off local disk, never fetched
  // during this install. A buffer that verified when it was cached proves nothing about the file now.
  it('refuses a cached archive whose manifest names a different plugin, before anything is uploaded', async () => {
    stubTheHappyPathAround(packageWith({ ...HONEST_MANIFEST, name: 'camera' }))
    await expect(install()).rejects.toThrow(/contains plugin "camera"/)
    expect(installPlugin).not.toHaveBeenCalled()
  })

  it('refuses a cached archive downgraded below the listed version, before anything is uploaded', async () => {
    stubTheHappyPathAround(packageWith({ ...HONEST_MANIFEST, version: '0.1.9' }))
    await expect(install()).rejects.toThrow(/older than the listed/)
    expect(installPlugin).not.toHaveBeenCalled()
  })

  // The unsigned cases above would still pass if install.ts checked against a permissive anchor set, so
  // this is the case that pins it to the set the app actually ships: a real, well-formed signature by a
  // key nobody anchored. Refusing it is the only outcome that distinguishes checking from pretending.
  it('refuses a package signed by a key outside the anchor set the app ships', async () => {
    stubTheHappyPathAround(await signedByAStranger(HONEST_MANIFEST))
    await expect(install()).rejects.toThrow(/does not check out against any key this app trusts/)
    expect(installPlugin).not.toHaveBeenCalled()
  })

  it('installs a package that passes and records the tier its signature earned', async () => {
    stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
    await install()
    expect(installPlugin).toHaveBeenCalled()
    const [, recordPatch] = vi.mocked(updatePrinter).mock.calls[0]
    expect(patchAppliedToRecord(recordPatch).installedPackageTrust).toEqual({ 'idle-timeout': 'unknown' })
  })
})

// The store page shows what the plugin's own repo last released, so the install has to fetch THAT
// release: fetching the one the list named would put an older build on the printer than the number the
// owner clicked. These pin both halves, including that the refusal still judges against the refreshed
// version, which is what stops a raised number from ever shipping stale bytes.
describe('runStoreInstall when the plugin repo has released since its list was published', () => {
  const LISTED_ASSET_URL = 'https://api.github.com/repos/fixture-owner/idle-timeout/releases/assets/1111'
  const FRESH_ASSET_URL = 'https://api.github.com/repos/fixture-owner/idle-timeout/releases/assets/2222'
  const REPO_ENTRY: MergedEntry = { ...LISTED_ENTRY, download_url: LISTED_ASSET_URL }

  function stubTheRepoAnswering(fresh: { version: string; downloadUrl: string } | null): void {
    vi.mocked(findCatalogVariant).mockReturnValue(REPO_ENTRY)
    vi.mocked(fetchLatestRelease).mockResolvedValue(fresh)
  }

  function entrySentToTheDevice(): MergedEntry {
    return vi.mocked(resolveArchiveBytes).mock.calls[0][0]
  }

  beforeEach(() => vi.clearAllMocks())

  it('fetches the release the store showed rather than the one the list named', async () => {
    stubTheHappyPathAround(packageWith({ ...HONEST_MANIFEST, version: '0.3.0' }))
    stubTheRepoAnswering({ version: '0.3.0', downloadUrl: FRESH_ASSET_URL })
    await install()

    expect(entrySentToTheDevice().version).toBe('0.3.0')
    expect(entrySentToTheDevice().download_url).toBe(FRESH_ASSET_URL)
  })

  it('still refuses a package older than the refreshed version', async () => {
    stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
    stubTheRepoAnswering({ version: '0.3.0', downloadUrl: FRESH_ASSET_URL })

    await expect(install()).rejects.toThrow(/older than the listed/)
    expect(installPlugin).not.toHaveBeenCalled()
  })

  it('installs what the list named when the repo will not answer', async () => {
    stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
    stubTheRepoAnswering(null)
    await install()

    expect(entrySentToTheDevice().download_url).toBe(LISTED_ASSET_URL)
    expect(installPlugin).toHaveBeenCalled()
  })
})

// The printer refuses a package whose manifest does not declare everything inside it. When those bytes
// came from the download cache, the refusal is about that copy and not about the plugin: the cache is
// keyed by name and version, so a package rebuilt and re-released at the same version is handed back
// from the cache for good and the user can never reach the fixed release.
function refuseTheFirstUploadAsMalformed(): void {
  const refusal = new Error('daemon 409')
  vi.mocked(daemonGuardMessage).mockImplementation((failure) =>
    failure === refusal ? malformedPackageMessage('undeclared_member', ['files/site-packages/__pycache__/apprise.pyc']) : null,
  )
  vi.mocked(installPlugin).mockRejectedValueOnce(refusal).mockResolvedValue({ steps: [] } as never)
}

describe('a package the printer refuses as malformed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('installs the freshly downloaded package after throwing away the cached copy the printer refused', async () => {
    stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
    vi.mocked(discardCachedArchive).mockReturnValue(true)
    refuseTheFirstUploadAsMalformed()
    await install()
    expect(vi.mocked(discardCachedArchive).mock.calls.map(([entry]) => entry.name)).toEqual(['idle-timeout'])
    expect(vi.mocked(resolveArchiveBytes).mock.calls).toHaveLength(2)
    expect(vi.mocked(installPlugin).mock.calls).toHaveLength(2)
  })

  it('tells the user when there was no cached copy to blame, instead of uploading the same bytes twice', async () => {
    stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
    vi.mocked(discardCachedArchive).mockReturnValue(false)
    refuseTheFirstUploadAsMalformed()
    await expect(install()).rejects.toThrow(/MALFORMED_PACKAGE/)
    expect(vi.mocked(installPlugin).mock.calls).toHaveLength(1)
  })
})

// A dependency is uploaded by its own call, before the plugin the user actually picked, so it is a
// third way bytes reach the printer. Without these it verified nothing: deleting the check on the dep
// path left the whole suite green.
describe('dependency package verification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses a dependency whose manifest names a different plugin, before either package is uploaded', async () => {
    stubADependencyResolvingTo(packageWith({ ...HONEST_MANIFEST, name: 'camera' }), packageWith(HONEST_MANIFEST))
    await expect(installWithDependency()).rejects.toThrow(/contains plugin "camera"/)
    expect(installPlugin).not.toHaveBeenCalled()
  })

  it('installs a dependency that verifies, ahead of the plugin that needs it', async () => {
    stubADependencyResolvingTo(packageWith({ ...HONEST_MANIFEST, name: DEP_ID }), packageWith(HONEST_MANIFEST))
    await installWithDependency()
    expect(vi.mocked(installPlugin).mock.calls.map((call) => call[2])).toEqual([DEP_ID, 'idle-timeout'])
  })
})

// A plugin that did not install leaves its attempt on the printer record whether the user installed it
// on its own or inside a batch, and its downloaded package is thrown away so retrying fetches the file
// again rather than being handed back the copy that was just refused.
function failedLogsWritten(): Record<string, { phases: { items: { output?: string }[] }[] }> {
  const patches = vi.mocked(updatePrinter).mock.calls.map(([, patch]) => patchAppliedToRecord(patch))

  return Object.assign({}, ...patches.map((patch) => patch.failedInstallLogs ?? {}))
}

const FAILED_BEFORE = { pluginId: 'earlier', timestamp: 1, ok: false, phases: [] }

describe('what a single install leaves behind when the plugin did not install', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps why the plugin did not install', async () => {
    stubTheHappyPathAround(packageWith({ ...HONEST_MANIFEST, name: 'camera' }))
    await expect(install()).rejects.toThrow()
    expect(failedLogsWritten()['idle-timeout'].phases[0].items[0].output).toMatch(/contains plugin "camera"/)
  })

  it('keeps why a dependency did not install, under the dependency, not the plugin waiting on it', async () => {
    stubADependencyResolvingTo(packageWith({ ...HONEST_MANIFEST, name: 'camera' }), packageWith(HONEST_MANIFEST))
    await expect(installWithDependency()).rejects.toThrow()
    expect(Object.keys(failedLogsWritten())).toEqual([DEP_ID, 'idle-timeout'])
    // The dependency was refused; the plugin waiting on it simply never got its turn, and each is
    // filed with its own reason, the same two sentences a batch writes for the same pair.
    expect(failedLogsWritten()[DEP_ID].phases[0].items[0].output).toMatch(/contains plugin "camera"/)
    expect(failedLogsWritten()['idle-timeout'].phases[0].items[0].output).toMatch(/which it needs, was not installed either/)
  })

  it('throws away the downloaded copy of the package it refused', async () => {
    stubTheHappyPathAround(packageWith({ ...HONEST_MANIFEST, name: 'camera' }))
    await expect(install()).rejects.toThrow()
    expect(vi.mocked(discardCachedArchive).mock.calls.map(([entry]) => entry.name)).toEqual(['idle-timeout'])
  })

  // Installing this plugin answers for this plugin only. Camera is on the printer too and its own
  // refused update is still unexplained, so installing something else cannot be what clears it.
  it('forgets an earlier failure of the plugin that just installed, and no one else', async () => {
    stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
    vi.mocked(capsAfterInstall).mockResolvedValue({ installedIds: ['idle-timeout', 'camera'] } as never)
    const earlier = { 'idle-timeout': FAILED_BEFORE, camera: FAILED_BEFORE }
    await install()
    const [, recordPatch] = vi.mocked(updatePrinter).mock.calls[0]
    expect(Object.keys(patchAppliedToRecord(recordPatch, { failedInstallLogs: earlier }).failedInstallLogs ?? {})).toEqual(['camera'])
  })
})
