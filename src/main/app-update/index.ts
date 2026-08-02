// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { app, shell, type BrowserWindow } from 'electron'
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { reportEvent } from '../analytics'
import { loadSettings, saveSettings, type RepoCoords } from '../settings'
import { autoUpdateFeed } from './feed'
import { fetchPublishedReleases, fetchReleaseInstallers, downloadPublicAsset } from './public-releases'
import { checkIntervalMs, pickPlatformAsset, type UpdateFrequency } from './schedule'
import {
  updateStrategyForPlatform,
  autoInstallPayload,
  manualUpdatePayload,
  newestApplicableRelease,
  toReleaseRows,
  type UpdateAvailablePayload,
  type AppReleaseRow,
} from './view'

var listenersWired = false
var pollHandle: ReturnType<typeof setInterval> | null = null
var appliedVersion: string | null = null

export interface RollbackResult {
  outcome: 'installer' | 'page'
}

// The release repo testers update from. Baked like the registry's OFFICIAL_REMOTE so a stale
// settings.json can never drop it; settings.appUpdateRepo overrides it for a custom build.
const DEFAULT_APP_REPO: RepoCoords = { owner: 'Bespok3d', repo: 'Bespok3d-desktop' }

type WindowGetter = () => BrowserWindow

function resolveAppRepo(): RepoCoords {
  return loadSettings().appUpdateRepo ?? DEFAULT_APP_REPO
}

// Windows/Linux can auto-install via electron-updater; an unsigned, dmg-only macOS build cannot, so
// it falls back to the manual open-download flow.
function autoInstallSupported(): boolean {
  return updateStrategyForPlatform(process.platform) === 'autoInstall'
}

function sendToRenderer(getMainWindow: WindowGetter, channel: string, payload: unknown): void {
  getMainWindow().webContents.send(channel, payload)
}

function reportError(getMainWindow: WindowGetter, error: Error): void {
  console.warn(`[updater] ${String(error)}`)
  sendToRenderer(getMainWindow, 'app-update:error', String(error))
}

// The published release for the incoming version, so the modal can show the same notes the Update
// pane does (independent of electron-updater's releaseNotes) and offer the release page as a manual
// fallback when the in-app download stalls.
async function matchingRelease(version: string): Promise<{ body: string; url: string } | null> {
  try {
    const releases = await fetchPublishedReleases(resolveAppRepo())
    const release = releases.find((entry) => entry.tag.replace(/^v/, '') === version)

    return release ? { body: release.body, url: release.url } : null
  } catch {
    return null
  }
}

async function emitAvailable(getMainWindow: WindowGetter, updateInfo: UpdateInfo): Promise<void> {
  const settings = loadSettings()
  const base = autoInstallPayload(updateInfo)
  const release = await matchingRelease(updateInfo.version)
  const payload: UpdateAvailablePayload = {
    ...base,
    releaseNotesMarkdown: release?.body || base.releaseNotesMarkdown,
    releaseUrl: release?.url,
    autoDownload: settings.appUpdateAutoDownload,
    installOnQuit: settings.appUpdateInstallOnQuit,
  }
  sendToRenderer(getMainWindow, 'app-update:available', payload)
}

// checkForUpdates (not ...AndNotify) so the renderer owns the notification, not Squirrel. Wired once.
function wireListeners(getMainWindow: WindowGetter): void {
  if (listenersWired) return
  listenersWired = true
  autoUpdater.on('update-available', (updateInfo: UpdateInfo) => { void emitAvailable(getMainWindow, updateInfo) })
  autoUpdater.on('update-not-available', () => sendToRenderer(getMainWindow, 'app-update:none', app.getVersion()))
  autoUpdater.on('download-progress', (progress: ProgressInfo) =>
    sendToRenderer(getMainWindow, 'app-update:progress', progress.percent))
  autoUpdater.on('update-downloaded', (updateInfo: UpdateInfo) =>
    sendToRenderer(getMainWindow, 'app-update:downloaded', updateInfo.version))
  autoUpdater.on('error', (error: Error) => reportError(getMainWindow, error))
}

function applyPreferences(): void {
  const settings = loadSettings()
  autoUpdater.autoDownload = settings.appUpdateAutoDownload
  autoUpdater.autoInstallOnAppQuit = settings.appUpdateInstallOnQuit
  autoUpdater.allowPrerelease = true
  // A release asset download 302-redirects to a storage host. The differential downloader (Windows
  // NSIS / Linux AppImage) issues per-block HTTP range requests against that redirect target and
  // stalls SILENTLY there (no error event), freezing the progress bar partway. Forcing a full-file
  // download trades extra bytes for a path that actually completes.
  autoUpdater.disableDifferentialDownload = true
}

// True when an app repo is configured. Also sets the feed once, wires listeners once, and re-applies
// the user's preferences each call so reconfigure takes effect live.
function ensureConfigured(getMainWindow: WindowGetter): boolean {
  const feed = autoUpdateFeed(resolveAppRepo())
  if (!feed) return false
  if (!autoInstallSupported()) return true
  if (!listenersWired) {
    autoUpdater.setFeedURL(feed)
    wireListeners(getMainWindow)
  }
  applyPreferences()

  return true
}

// macOS: check the latest release and let the modal open the download page; report up-to-date too.
async function checkMacUpdate(getMainWindow: WindowGetter): Promise<void> {
  const releases = await fetchPublishedReleases(resolveAppRepo())
  const release = newestApplicableRelease(releases, app.getVersion())
  if (!release) {
    sendToRenderer(getMainWindow, 'app-update:none', app.getVersion())

    return
  }
  sendToRenderer(getMainWindow, 'app-update:available', manualUpdatePayload(release))
}

function runCheck(getMainWindow: WindowGetter): Promise<unknown> {
  if (autoInstallSupported()) return autoUpdater.checkForUpdates()

  return checkMacUpdate(getMainWindow)
}

function schedulePoll(getMainWindow: WindowGetter, frequency: UpdateFrequency): void {
  if (pollHandle) clearInterval(pollHandle)
  pollHandle = null
  const interval = checkIntervalMs(frequency)
  if (!interval) return
  pollHandle = setInterval(() => runCheck(getMainWindow).catch((error) => reportError(getMainWindow, error)), interval)
}

// Check for an app update on launch and on a schedule. No-op only when no app repo is resolvable;
// being signed out of GitHub changes nothing, because the release stream is public.
export function startAutoUpdates(getMainWindow: WindowGetter): void {
  recordRunVersion()
  if (!ensureConfigured(getMainWindow)) return
  const frequency = loadSettings().appUpdateFrequency
  if (frequency !== 'manual') runCheck(getMainWindow).catch((error) => reportError(getMainWindow, error))
  schedulePoll(getMainWindow, frequency)
}

export function checkForUpdatesNow(getMainWindow: WindowGetter): void {
  if (!ensureConfigured(getMainWindow)) return
  runCheck(getMainWindow).catch((error) => reportError(getMainWindow, error))
}

export function reconfigureUpdates(getMainWindow: WindowGetter): void {
  if (!ensureConfigured(getMainWindow)) return
  schedulePoll(getMainWindow, loadSettings().appUpdateFrequency)
}

export function downloadAppUpdate(): void {
  autoUpdater.downloadUpdate()
}

export function installAppUpdate(): void {
  autoUpdater.quitAndInstall()
}

export function openAppDownloadPage(url: string): void {
  shell.openExternal(url)
}

export async function listAppReleases(): Promise<AppReleaseRow[]> {
  const releases = await fetchPublishedReleases(resolveAppRepo())

  return toReleaseRows(releases, app.getVersion())
}

// Manual rollback: download the chosen release's installer for this platform and hand it to the OS
// (the NSIS exe / dmg reinstalls in place). With no matching installer, open the release page instead.
export async function rollbackToRelease(tag: string): Promise<RollbackResult> {
  const appRepo = resolveAppRepo()
  const releases = await fetchPublishedReleases(appRepo)
  const release = releases.find((entry) => entry.tag === tag)
  if (!release) throw new Error(`Release ${tag} not found`)
  const installers = await fetchReleaseInstallers(appRepo, tag, process.platform, process.arch)
  const asset = pickPlatformAsset(installers, process.platform, process.arch)
  if (!asset) {
    await shell.openExternal(release.url)

    return { outcome: 'page' }
  }
  const installerPath = join(app.getPath('temp'), asset.name)
  writeFileSync(installerPath, await downloadPublicAsset(asset.downloadUrl))
  const openError = await shell.openPath(installerPath)
  if (openError) throw new Error(openError)

  return { outcome: 'installer' }
}

// Detect that the app version changed since the last run (an update applied or a rollback finished),
// remembering it once so the UI can confirm it, then record the running version for next time.
export function recordRunVersion(): void {
  const current = app.getVersion()
  const previous = loadSettings().lastRunVersion
  if (previous && previous !== current) noteVersionChange(previous, current)
  saveSettings({ lastRunVersion: current })
}

// The one place that decides the version moved, so the confirmation the user sees and the usage event
// can never disagree. A first run has no previous version and therefore reaches neither: a brand-new
// install is never counted as an update. A rollback lands here too, and previous_version is what says
// which way it went.
function noteVersionChange(previous: string, current: string): void {
  appliedVersion = current
  reportEvent('app_updated', { previous_version: previous })
}

// Returns the version we landed on if it changed since last run, once, then clears it.
export function consumeAppliedUpdate(): string | null {
  const result = appliedVersion
  appliedVersion = null

  return result
}
