// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReleaseInfo } from '../git-host/connector'
import { isReleaseNewer, compareSemanticVersions } from './version'

// Pure mapping from an update source (electron-updater on Windows/Linux, a GitHub release on
// macOS) to the single payload the renderer modal consumes. The action discriminates the two
// flows: 'autoInstall' restarts into the downloaded update; 'openDownload' opens the release
// page (macOS cannot auto-install while unsigned).

export type UpdateStrategy = 'autoInstall' | 'openDownload'

export interface UpdateAvailablePayload {
  version: string
  action: UpdateStrategy
  releaseNotesMarkdown: string
  releaseUrl?: string
  warningsMarkdown?: string
  // Set when sending an autoInstall payload, so the modal knows whether the download starts on its
  // own (vs offering a Download button) and whether it applies on quit (vs prompting a restart now).
  autoDownload?: boolean
  installOnQuit?: boolean
}

export interface AppReleaseRow {
  version: string
  tag: string
  url: string
  publishedAt: string | null
  prerelease: boolean
  isCurrent: boolean
  // Newer than the running build (an update) vs older (a rollback install). Compared in main because
  // the renderer cannot order prerelease (-alpha.N) versions. Meaningless when isCurrent is true.
  isNewer: boolean
  notes: string
}

interface ElectronReleaseNote {
  version: string
  note: string | null
}

export interface ElectronUpdateInfo {
  version: string
  releaseNotes?: string | ElectronReleaseNote[] | null
}

export function updateStrategyForPlatform(platform: NodeJS.Platform): UpdateStrategy {
  // Windows/Linux update via electron-updater; macOS too, now that its builds are signed + notarized,
  // so Squirrel.Mac accepts the update. openDownload remains only for any unsupported platform.
  return platform === 'darwin' || platform === 'win32' || platform === 'linux' ? 'autoInstall' : 'openDownload'
}

function releaseNotesToMarkdown(releaseNotes: ElectronUpdateInfo['releaseNotes']): string {
  if (!releaseNotes) return ''
  if (typeof releaseNotes === 'string') return releaseNotes

  return releaseNotes.map((entry) => entry.note ?? '').filter(Boolean).join('\n\n')
}

export function autoInstallPayload(updateInfo: ElectronUpdateInfo): UpdateAvailablePayload {
  return {
    version: updateInfo.version,
    action: 'autoInstall',
    releaseNotesMarkdown: releaseNotesToMarkdown(updateInfo.releaseNotes),
  }
}

export function manualUpdatePayload(release: ReleaseInfo): UpdateAvailablePayload {
  return {
    version: release.tag.replace(/^v/, ''),
    action: 'openDownload',
    releaseNotesMarkdown: release.body,
    releaseUrl: release.url,
  }
}

export function newestApplicableRelease(releases: ReleaseInfo[], installedVersion: string): ReleaseInfo | null {
  const newer = releases.filter((release) => isReleaseNewer(installedVersion, release.tag))
  if (newer.length === 0) return null

  return newer.reduce((latest, release) =>
    compareSemanticVersions(latest.tag, release.tag) < 0 ? release : latest,
  )
}

function releaseRow(release: ReleaseInfo, installedVersion: string): AppReleaseRow {
  const order = compareSemanticVersions(installedVersion, release.tag)

  return {
    version: release.tag.replace(/^v/, ''),
    tag: release.tag,
    url: release.url,
    publishedAt: release.publishedAt,
    prerelease: release.prerelease,
    isCurrent: order === 0,
    isNewer: order < 0,
    notes: release.body,
  }
}

// Releases as renderer rows, newest first, with the installed one flagged (for the rollback list).
export function toReleaseRows(releases: ReleaseInfo[], installedVersion: string): AppReleaseRow[] {
  const rows = releases.map((release) => releaseRow(release, installedVersion))

  return rows.sort((left, right) => compareSemanticVersions(right.tag, left.tag))
}
