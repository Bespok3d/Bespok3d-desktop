// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UpdateInfo } from 'electron-updater'
import type { InstalledBuild, PendingBuild } from '../settings'

// One fingerprint for a published build: the sha512 of every file its update feed lists. A rebuild
// re-uploaded under the same version changes it, so the offer follows the build, never the number.
export function buildDigest(updateInfo: Pick<UpdateInfo, 'files'>): string {
  return updateInfo.files.map((file) => file.sha512).sort().join(',')
}

// A record describes the build that runs only while the executable it was taken on still runs. A
// build installed by hand replaces the executable without the updater seeing it, so its record is stale.
// With no stamp to read, nothing tells which build runs, so no record matches it.
function runningBuildRecord(
  installedBuild: InstalledBuild | undefined, runningVersion: string, executableStamp: number | undefined,
): InstalledBuild | undefined {
  if (executableStamp === undefined) return undefined
  if (installedBuild?.version !== runningVersion || installedBuild.executableStamp !== executableStamp) return undefined

  return installedBuild
}

// A build published under the running version is an update when its fingerprint differs from the
// one recorded for the build that runs. With no such record there is nothing to compare, so no offer.
export function isRebuildOfInstalled(
  updateInfo: Pick<UpdateInfo, 'version' | 'files'>, runningVersion: string, installedBuild: InstalledBuild | undefined, executableStamp: number | undefined,
): boolean {
  if (updateInfo.version !== runningVersion) return false
  const runningBuild = runningBuildRecord(installedBuild, runningVersion, executableStamp)
  if (!runningBuild) return false

  return runningBuild.digest !== buildDigest(updateInfo)
}

// The first check of a build the app holds no record for records the published one as the build it
// runs, so the next rebuild under that version has something to differ from.
export function firstBuildRecord(
  updateInfo: Pick<UpdateInfo, 'version' | 'files'>, runningVersion: string, installedBuild: InstalledBuild | undefined, executableStamp: number | undefined,
): InstalledBuild | null {
  if (updateInfo.version !== runningVersion || executableStamp === undefined) return null
  if (runningBuildRecord(installedBuild, runningVersion, executableStamp)) return null

  return { version: runningVersion, digest: buildDigest(updateInfo), executableStamp }
}

// A downloaded build runs only once a restart installs it, and installing it replaces the executable.
// While the executable that downloaded it still runs, the old build is the one installed.
export function landedBuild(
  pendingBuild: PendingBuild | undefined, runningVersion: string, executableStamp: number | undefined,
): InstalledBuild | null {
  if (pendingBuild?.version !== runningVersion || executableStamp === undefined) return null
  if (pendingBuild.executableStamp === executableStamp) return null

  return { version: pendingBuild.version, digest: pendingBuild.digest, executableStamp }
}
