// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdmZip from 'adm-zip'
import * as openpgp from 'openpgp'
import type { BrowserWindow } from 'electron'
import type { MergedEntry } from '../registry/model'
import type { PrinterRecord } from '../printers'

vi.mock('../printers', () => ({ updatePrinter: vi.fn() }))
vi.mock('../analytics', () => ({ reportEvent: vi.fn() }))
vi.mock('../analytics/errors', () => ({ reportErrorEvent: vi.fn() }))
vi.mock('../registry', () => ({ loadCatalog: vi.fn() }))
vi.mock('./catalog-archive', () => ({ findCatalogVariant: vi.fn(), resolveArchiveBytes: vi.fn(), discardCachedArchive: vi.fn() }))
vi.mock('./progress', () => ({ sendProgress: vi.fn(), sendUpload: vi.fn() }))
// capsOrFallback is NOT stubbed: it is the degrade under test, so it runs for real over the mocked
// printer reads below. A stub of it would prove only that the stub does not throw.
vi.mock('./record-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./record-sync')>()),
  capsAfterInstall: vi.fn(),
  recordAppliedVars: () => ({}),
}))
vi.mock('../daemon-client/client', () => ({ fetchCapabilities: vi.fn(), installPlugin: vi.fn(), fetchDaemonStatus: vi.fn() }))
vi.mock('../daemon-client/status', () => ({ getManagedRecord: vi.fn(), parseCaps: () => ({ installedIds: [] }) }))
vi.mock('../daemon-client/feeds/install-progress', () => ({ watchInstallProgress: vi.fn(), installPhaseMessage: (phase: string) => phase }))
vi.mock('../daemon-client/guard', () => ({ daemonGuardMessage: vi.fn() }))
vi.mock('../registry/resolve/latest-release', () => ({ fetchLatestRelease: vi.fn() }))

import { installGuarded } from './install'
import { reportErrorEvent } from '../analytics/errors'
import { reportEvent } from '../analytics'
import { fetchLatestRelease } from '../registry/resolve/latest-release'
import { updatePrinter } from '../printers'
import { loadCatalog } from '../registry'
import { findCatalogVariant, resolveArchiveBytes, discardCachedArchive } from './catalog-archive'
import { capsAfterInstall } from './record-sync'
import { fetchCapabilities, installPlugin, fetchDaemonStatus } from '../daemon-client/client'
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

// What a package carries under files/ is unpacked into a directory named for its own plugin, so two
// plugins shipping a folder of the same name are not writing over each other's copy of anything.
function packageDeploying(manifest: Record<string, unknown>, deployedPaths: readonly string[]): Buffer {
  const archive = new AdmZip()
  archive.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'))
  deployedPaths.forEach((deployedPath) => archive.addFile(`files/${deployedPath}`, Buffer.from('# obviously fake payload\n', 'utf8')))

  return archive.toBuffer()
}

describe('a plugin and its dependency carrying a folder of the same name', () => {
  beforeEach(() => vi.clearAllMocks())

  // Every base-layer plugin ships its patches under patches/, so reading a shared folder name as a
  // clash refused the whole family: rfid-ntag could not be installed beside the plugins it now needs.
  it('installs both, because each package is unpacked into a directory of its own', async () => {
    stubADependencyResolvingTo(
      packageDeploying({ ...HONEST_MANIFEST, name: DEP_ID }, ['patches/fm175xx_reader-v1.4.patch']),
      packageDeploying(HONEST_MANIFEST, ['patches/print_task_config-v1.6.patch']),
    )
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

// Before a single byte is sent, the install reads the printer to work out which dependencies are
// already there. A printer whose jinni is mid-restart answers that read with a 500, and that used to
// abort an install that had not started yet and file the plugin as one that failed to install.
describe('a printer that will not say what it already has', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gets the plugin installed anyway, dependency and all', async () => {
    stubADependencyResolvingTo(packageWith({ ...HONEST_MANIFEST, name: DEP_ID }), packageWith(HONEST_MANIFEST))
    vi.mocked(fetchCapabilities).mockRejectedValue(new Error('daemon 500: Internal Server Error'))
    await installWithDependency()
    expect(vi.mocked(installPlugin).mock.calls.map((call) => call[2])).toEqual([DEP_ID, 'idle-timeout'])
    expect(failedLogsWritten()).toEqual({})
  })

  it('is never asked by a plugin that needs nothing else installed first', async () => {
    stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
    await install()
    expect(fetchCapabilities).not.toHaveBeenCalled()
  })
})

describe('what a single install counts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts one install for the plugin the user chose, not one per package that went up', async () => {
    stubADependencyResolvingTo(packageWith({ ...HONEST_MANIFEST, name: DEP_ID }), packageWith(HONEST_MANIFEST))
    await installWithDependency()

    expect(vi.mocked(reportEvent)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(reportEvent)).toHaveBeenCalledWith('plugin_installed', {})
  })

  it('counts nothing when the install threw, because a plugin that did not land is not installed', async () => {
    stubTheHappyPathAround(packageWith({ ...HONEST_MANIFEST, name: 'some-other-plugin' }))
    await install().catch(() => undefined)

    expect(vi.mocked(reportEvent)).not.toHaveBeenCalled()
  })

  it('says an install failed, and what kind of failure it was', async () => {
    stubTheHappyPathAround(packageWith({ ...HONEST_MANIFEST, name: 'some-other-plugin' }))
    await install().catch(() => undefined)

    expect(vi.mocked(reportErrorEvent)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(reportErrorEvent).mock.calls[0][1]).toBe('plugin-install')
  })

  it('says nothing about failures when the plugin installed', async () => {
    stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
    await install()

    expect(vi.mocked(reportErrorEvent)).not.toHaveBeenCalled()
  })
})

// The floor used to be checked in the store card's button and nowhere else, so every install that does
// not come from a click on that card walked past it: a recovery after a firmware update, a bundled
// first install, a sideloaded .b3, and a dependency the owner never chose. These call installGuarded
// directly, which is exactly what those paths do, and no card is involved anywhere in them.
function stubEntryDemanding(floor: string, reportedDaemon: string): void {
  stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
  vi.mocked(findCatalogVariant).mockReturnValue({ ...LISTED_ENTRY, min_daemon_version: floor })
  vi.mocked(fetchDaemonStatus).mockResolvedValue({ version: reportedDaemon } as never)
}

const DAEMON_MANIFEST = {
  name: 'bespok3d-daemon',
  version: '0.12.23',
  install: { config: { 'main.cfg': 'config/main.cfg' } },
  files: [{ path: 'config/main.cfg', sha256: 'f'.repeat(64) }],
}

// The daemon's own store card sends its Update through this path, so the daemon arrives here as an
// ordinary package and is weighed like one. What makes it different is the direction of the question:
// the daemon is the package that declares which support package it will drive.
function stubADaemonDemandingSupportPackage(jinniFloor: string, reportedJinni: string): void {
  stubTheHappyPathAround(packageWith(DAEMON_MANIFEST))
  vi.mocked(findCatalogVariant).mockReturnValue({
    ...LISTED_ENTRY,
    name: 'bespok3d-daemon',
    version: '0.12.23',
    min_jinni_version: jinniFloor,
  })
  vi.mocked(fetchDaemonStatus).mockResolvedValue({ version: '0.12.19' } as never)
  vi.mocked(fetchCapabilities).mockResolvedValue({ jinni_version: reportedJinni } as never)
  vi.mocked(capsAfterInstall).mockResolvedValue({ installedIds: ['bespok3d-daemon'] } as never)
}

function installTheDaemon(): Promise<unknown> {
  return installGuarded({} as BrowserWindow, 'printer-1', 'bespok3d-daemon')
}

describe('the compatibility floor on the install path itself', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('refuses a package the daemon on this printer is too old for, with no card in sight', async () => {
    stubEntryDemanding('0.12.22', '0.12.19')

    await expect(install()).rejects.toThrow(/0\.12\.22/)
    expect(vi.mocked(installPlugin)).not.toHaveBeenCalled()
  })

  it('names the side to update and the version to reach it', async () => {
    stubEntryDemanding('0.12.22', '0.12.19')
    const refusal = await install().catch((error: Error) => error.message)

    expect(refusal).toContain('idle-timeout')
    expect(refusal).toContain('0.12.22')
    expect(refusal).toContain('0.12.19')
    expect(refusal).toContain('Update the daemon on this printer')
  })

  it('refuses a dependency the owner never chose and never saw a card for', async () => {
    stubADependencyResolvingTo(packageWith({ ...HONEST_MANIFEST, name: DEP_ID }), packageWith(HONEST_MANIFEST))
    vi.mocked(findCatalogVariant).mockImplementation((_catalog, pluginId) => ({
      ...LISTED_ENTRY,
      name: pluginId,
      ...(pluginId === DEP_ID ? { min_daemon_version: '0.12.22' } : {}),
    }))
    vi.mocked(fetchDaemonStatus).mockResolvedValue({ version: '0.12.19' } as never)

    await expect(installWithDependency()).rejects.toThrow(/0\.12\.22/)
    expect(vi.mocked(installPlugin)).not.toHaveBeenCalled()
  })

  // The plugin is the one refused, and its dependency is fine on its own. Installing the dependency
  // anyway leaves the owner things he never chose, for a plugin he did not get.
  it('leaves nothing behind when the plugin is refused but its dependency would have installed', async () => {
    stubADependencyResolvingTo(packageWith({ ...HONEST_MANIFEST, name: DEP_ID }), packageWith(HONEST_MANIFEST))
    vi.mocked(findCatalogVariant).mockImplementation((_catalog, pluginId) => ({
      ...LISTED_ENTRY,
      name: pluginId,
      ...(pluginId === DEP_ID ? {} : { min_daemon_version: '0.12.22' }),
    }))
    vi.mocked(fetchDaemonStatus).mockResolvedValue({ version: '0.12.19' } as never)

    await expect(installWithDependency()).rejects.toThrow(/0\.12\.22/)
    expect(vi.mocked(installPlugin)).not.toHaveBeenCalled()
  })

})

// The pair only used to be asked in one direction: is this printer's daemon new enough for the
// package? Nothing asked the reverse, so the daemon's own Update button could hand a printer a daemon
// that then refuses to be driven by the support package already on it, leaving the printer enrolled
// and unmanageable with no way back through the app.
describe('the support-package floor a daemon declares', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('refuses a daemon the support package on this printer is too old to be driven by', async () => {
    stubADaemonDemandingSupportPackage('0.1.10', '0.1.9')
    const refusal = await installTheDaemon().catch((error: Error) => error.message)

    expect(refusal).toContain('0.1.10')
    expect(refusal).toContain('0.1.9')
    expect(refusal).toContain('Update the printer support package')
    expect(vi.mocked(installPlugin)).not.toHaveBeenCalled()
  })
})

describe('the compatibility floor lets everything else through', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('installs when the printer reports a daemon at the floor', async () => {
    stubEntryDemanding('0.12.22', '0.12.23')
    await install()

    expect(vi.mocked(installPlugin)).toHaveBeenCalledTimes(1)
  })

  it('installs when the printer will not say what daemon it is running', async () => {
    stubTheHappyPathAround(packageWith(HONEST_MANIFEST))
    vi.mocked(findCatalogVariant).mockReturnValue({ ...LISTED_ENTRY, min_daemon_version: '0.12.22' })
    vi.mocked(fetchDaemonStatus).mockRejectedValue(new Error('daemon restarting'))
    await install()

    expect(vi.mocked(installPlugin)).toHaveBeenCalledTimes(1)
  })

  it('installs a daemon when the support package on this printer meets its floor', async () => {
    stubADaemonDemandingSupportPackage('0.1.10', '0.1.11')
    await installTheDaemon()

    expect(vi.mocked(installPlugin)).toHaveBeenCalledTimes(1)
  })
})
