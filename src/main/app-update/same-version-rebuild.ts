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
    if (isRebuildOfInstalled(updateInfo, app.getVersion(), loadSettings().installedBuild)) return isOfferedToThisApp(updateInfo)

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
  const record = firstBuildRecord(updateInfo, app.getVersion(), loadSettings().installedBuild)
  if (record) saveSettings({ installedBuild: record })
}

// An AppImage runs from a read-only mount whose files keep the times the build stored, so the
// AppImage file itself, which the updater writes anew, is what an install replaces.
function executableStamp(): number {
  return statSync(process.env.APPIMAGE ?? process.execPath).mtimeMs
}

// A downloaded update may never install (the restart can fail), so its fingerprint waits until the
// app runs it.
export function recordDownloadedBuild(updateInfo: UpdateInfo): void {
  saveSettings({ pendingBuild: { version: updateInfo.version, digest: buildDigest(updateInfo), executableStamp: executableStamp() } })
}

export function recordLandedBuild(): void {
  const landed = landedBuild(loadSettings().pendingBuild, app.getVersion(), executableStamp())
  if (landed) saveSettings({ installedBuild: landed, pendingBuild: undefined })
}
