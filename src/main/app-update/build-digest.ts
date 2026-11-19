// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UpdateInfo } from 'electron-updater'
import type { InstalledBuild, PendingBuild } from '../settings'

// One fingerprint for a published build: the sha512 of every file its update feed lists. A rebuild
// re-uploaded under the same version changes it, so the offer follows the build, never the number.
export function buildDigest(updateInfo: Pick<UpdateInfo, 'files'>): string {
  return updateInfo.files.map((file) => file.sha512).sort().join(',')
}

// A build published under the running version is an update when its fingerprint differs from the
// one recorded for this app. With no record for this version there is nothing to compare, so no offer.
export function isRebuildOfInstalled(
  updateInfo: Pick<UpdateInfo, 'version' | 'files'>, installedVersion: string, installedBuild: InstalledBuild | undefined,
): boolean {
  if (updateInfo.version !== installedVersion) return false
  if (installedBuild?.version !== installedVersion) return false

  return installedBuild.digest !== buildDigest(updateInfo)
}

// The first check of a version the app holds no fingerprint for records the published one as the
// build it runs, so the next rebuild under that version has something to differ from.
export function firstBuildRecord(
  updateInfo: Pick<UpdateInfo, 'version' | 'files'>, installedVersion: string, installedBuild: InstalledBuild | undefined,
): InstalledBuild | null {
  if (updateInfo.version !== installedVersion) return null
  if (installedBuild?.version === installedVersion) return null

  return { version: installedVersion, digest: buildDigest(updateInfo) }
}

// A downloaded build runs only once a restart installs it, and installing it replaces the executable.
// While the executable that downloaded it still runs, the old build is the one installed.
export function landedBuild(
  pendingBuild: PendingBuild | undefined, runningVersion: string, executableStamp: number,
): InstalledBuild | null {
  if (pendingBuild?.version !== runningVersion) return null
  if (pendingBuild.executableStamp === executableStamp) return null

  return { version: pendingBuild.version, digest: pendingBuild.digest }
}
