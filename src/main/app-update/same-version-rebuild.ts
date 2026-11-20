// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { statSync } from 'fs'
import { app } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { loadSettings, saveSettings } from '../settings'
import { buildDigest, firstBuildRecord, isRebuildOfInstalled, landedBuild } from './build-digest'

type UpdateDecision = (updateInfo: UpdateInfo) => Promise<boolean>

// electron-updater answers "no update" for any build carrying the running version before it consults
// any hook it exposes, so a rebuild published under the same version is decided on top of its answer.
export function offerSameVersionRebuilds(): void {
  const updater = autoUpdater as unknown as { isUpdateAvailable: UpdateDecision }
  const versionDecision = updater.isUpdateAvailable.bind(autoUpdater)
  updater.isUpdateAvailable = async function decideUpdate(updateInfo: UpdateInfo): Promise<boolean> {
    if (isRebuildOfInstalled(updateInfo, app.getVersion(), loadSettings().installedBuild, executableStamp())) return isOfferedToThisApp(updateInfo)

    return versionDecision(updateInfo)
  }
}

// The same gates electron-updater puts on a newer version: the system must run the build, and the
// staged rollout must include this user.
async function isOfferedToThisApp(updateInfo: UpdateInfo): Promise<boolean> {
  if (!(await autoUpdater.isUpdateSupported(updateInfo))) return false

  return autoUpdater.isUserWithinRollout(updateInfo)
}

export function recordFirstBuild(updateInfo: UpdateInfo): void {
  const record = firstBuildRecord(updateInfo, app.getVersion(), loadSettings().installedBuild, executableStamp())
  if (record) saveSettings({ installedBuild: record })
}

// An AppImage runs from a read-only mount whose files keep the times the build stored, so the
// AppImage file itself, which the updater writes anew, is what an install replaces. An AppImage moved
// while it runs leaves no file to read, and the update check must still work then.
function executableStamp(): number | undefined {
  return statSync(process.env.APPIMAGE ?? process.execPath, { throwIfNoEntry: false })?.mtimeMs
}

// A downloaded update may never install (the restart can fail), so its fingerprint waits until the
// app runs it.
export function recordDownloadedBuild(updateInfo: UpdateInfo): void {
  const stamp = executableStamp()
  // With no stamp, an older download left pending would be taken for the build this download installs.
  const pendingBuild = stamp === undefined ? undefined : { version: updateInfo.version, digest: buildDigest(updateInfo), executableStamp: stamp }

  saveSettings({ pendingBuild })
}

export function recordLandedBuild(): void {
  const landed = landedBuild(loadSettings().pendingBuild, app.getVersion(), executableStamp())
  if (landed) saveSettings({ installedBuild: landed, pendingBuild: undefined })
}
