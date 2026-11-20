// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import type { UpdateInfo } from 'electron-updater'

const { updaterVersionDecision, updaterSupports, updaterRollout } = vi.hoisted(() => ({
  updaterVersionDecision: vi.fn(async () => false),
  updaterSupports: vi.fn(() => true),
  updaterRollout: vi.fn(async () => true),
}))

vi.mock('electron', () => ({ app: { getVersion: () => '1.0.0' } }))
vi.mock('electron-updater', () => ({
  autoUpdater: { isUpdateAvailable: updaterVersionDecision, isUpdateSupported: updaterSupports, isUserWithinRollout: updaterRollout },
}))
vi.mock('fs', () => ({ statSync: vi.fn() }))
vi.mock('../settings', () => ({ loadSettings: vi.fn(), saveSettings: vi.fn() }))

import { statSync } from 'fs'
import { autoUpdater } from 'electron-updater'
import { loadSettings, saveSettings } from '../settings'
import { buildDigest } from './build-digest'
import { offerSameVersionRebuilds, recordDownloadedBuild, recordFirstBuild, recordLandedBuild } from './same-version-rebuild'

const RUNNING_EXECUTABLE_STAMP = 1000

function publishedBuild(version: string, fileDigest: string): UpdateInfo {
  return { version, files: [{ url: `app-${fileDigest}.zip`, sha512: fileDigest }] } as unknown as UpdateInfo
}

function updaterDecision(updateInfo: UpdateInfo): Promise<boolean> {
  return (autoUpdater as unknown as { isUpdateAvailable: (info: UpdateInfo) => Promise<boolean> }).isUpdateAvailable(updateInfo)
}

function settingsWith(extra: Partial<ReturnType<typeof loadSettings>>): ReturnType<typeof loadSettings> {
  return { installedBuild: { version: '1.0.0', digest: buildDigest(publishedBuild('1.0.0', 'first-build')), executableStamp: RUNNING_EXECUTABLE_STAMP }, ...extra } as ReturnType<typeof loadSettings>
}

beforeAll(() => {
  offerSameVersionRebuilds()
})

beforeEach(() => {
  vi.clearAllMocks()
  updaterSupports.mockReturnValue(true)
  updaterRollout.mockResolvedValue(true)
  vi.mocked(statSync).mockReturnValue({ mtimeMs: RUNNING_EXECUTABLE_STAMP } as ReturnType<typeof statSync>)
  vi.mocked(loadSettings).mockReturnValue(settingsWith({}))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the app update decision', () => {
  it('offers a rebuild published under the running version', async () => {
    await expect(updaterDecision(publishedBuild('1.0.0', 'second-build'))).resolves.toBe(true)
  })

  it('leaves the very build that runs, and every other version, to the updater', async () => {
    await expect(updaterDecision(publishedBuild('1.0.0', 'first-build'))).resolves.toBe(false)
    await expect(updaterDecision(publishedBuild('1.0.1', 'next-build'))).resolves.toBe(false)
    expect(updaterVersionDecision).toHaveBeenCalledTimes(2)
  })

  it('withholds a rebuild this system cannot run', async () => {
    updaterSupports.mockReturnValue(false)

    await expect(updaterDecision(publishedBuild('1.0.0', 'second-build'))).resolves.toBe(false)
  })

  it('withholds a rebuild whose staged rollout leaves this user out', async () => {
    updaterRollout.mockResolvedValue(false)

    await expect(updaterDecision(publishedBuild('1.0.0', 'second-build'))).resolves.toBe(false)
  })

  it('does not offer the running build again after it was installed without the updater', async () => {
    vi.mocked(loadSettings).mockReturnValue(settingsWith({ installedBuild: { version: '1.0.0', digest: buildDigest(publishedBuild('1.0.0', 'first-build')) } }))

    await expect(updaterDecision(publishedBuild('1.0.0', 'running-build'))).resolves.toBe(false)
  })
})

describe('an executable moved while it runs', () => {
  beforeEach(() => {
    vi.mocked(statSync).mockReturnValue(undefined)
  })

  it('leaves every decision to the updater instead of failing the check', async () => {
    await expect(updaterDecision(publishedBuild('1.0.0', 'second-build'))).resolves.toBe(false)
    expect(updaterVersionDecision).toHaveBeenCalledTimes(1)
  })

  it('records no build, since nothing tells which one runs', () => {
    const pendingBuild = { version: '1.0.0', digest: buildDigest(publishedBuild('1.0.0', 'second-build')), executableStamp: RUNNING_EXECUTABLE_STAMP }
    vi.mocked(loadSettings).mockReturnValue(settingsWith({ pendingBuild }))

    recordFirstBuild(publishedBuild('1.0.0', 'running-build'))
    recordLandedBuild()

    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('clears the pending download, so an older one is never taken for the build this download installs', () => {
    recordDownloadedBuild(publishedBuild('1.0.0', 'second-build'))

    expect(saveSettings).toHaveBeenCalledWith({ pendingBuild: undefined })
  })
})

describe('the build a check records', () => {
  it('replaces a record the running executable did not take with the published build', () => {
    vi.mocked(loadSettings).mockReturnValue(settingsWith({ installedBuild: { version: '1.0.0', digest: 'old-digest', executableStamp: RUNNING_EXECUTABLE_STAMP - 1 } }))

    recordFirstBuild(publishedBuild('1.0.0', 'running-build'))

    expect(saveSettings).toHaveBeenCalledWith({
      installedBuild: { version: '1.0.0', digest: buildDigest(publishedBuild('1.0.0', 'running-build')), executableStamp: RUNNING_EXECUTABLE_STAMP },
    })
  })
})

describe('the build a download records', () => {
  it('waits as pending, so a failed install never hides the rebuild', () => {
    recordDownloadedBuild(publishedBuild('1.0.0', 'second-build'))

    expect(saveSettings).toHaveBeenCalledWith({
      pendingBuild: { version: '1.0.0', digest: buildDigest(publishedBuild('1.0.0', 'second-build')), executableStamp: RUNNING_EXECUTABLE_STAMP },
    })
    expect(saveSettings).not.toHaveBeenCalledWith(expect.objectContaining({ installedBuild: expect.anything() }))
  })

  it('stamps the AppImage file when the app runs as one, the file its updater replaces', () => {
    vi.stubEnv('APPIMAGE', '/home/user/Bespok3d.AppImage')

    recordDownloadedBuild(publishedBuild('1.0.0', 'second-build'))

    expect(statSync).toHaveBeenCalledWith('/home/user/Bespok3d.AppImage', { throwIfNoEntry: false })
  })

  it('becomes the installed build once the app runs a new executable', () => {
    var pendingBuild = { version: '1.0.0', digest: 'second-digest', executableStamp: RUNNING_EXECUTABLE_STAMP - 1 }
    vi.mocked(loadSettings).mockReturnValue(settingsWith({ pendingBuild }))

    recordLandedBuild()

    expect(saveSettings).toHaveBeenCalledWith({ installedBuild: { version: '1.0.0', digest: 'second-digest', executableStamp: RUNNING_EXECUTABLE_STAMP }, pendingBuild: undefined })
  })

  it('stays pending while the executable that downloaded it still runs', () => {
    vi.mocked(loadSettings).mockReturnValue(settingsWith({ pendingBuild: { version: '1.0.0', digest: 'second-digest', executableStamp: RUNNING_EXECUTABLE_STAMP } }))

    recordLandedBuild()

    expect(saveSettings).not.toHaveBeenCalled()
  })
})
