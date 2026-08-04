// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcMain, shell, type BrowserWindow } from 'electron'
import { checkSsh, enrollPrinter } from './enrollment'
import { getAdapter, listAdapters } from './adapter-loader'
import type { AdapterInfo } from './adapter-loader'
import { loadSettings, saveSettings, setSourceEnabled, setChannelEnabled } from './settings'
import type { ReleaseChannel } from './settings'
import type { AppSettings } from './settings'
import {
  generateKey,
  listKeys,
  removeKey,
  exportPublicKey,
  exportPrivateKey,
  setDefault,
  setAssignments,
  setKeyIcon,
  setPublishedAt,
} from './keys'
import { savePrinter, loadPrinters, loadPublicPrinters, updatePrinter, removePrinter, pingPrinter, checkSshOpen, probeService, probeServiceUrl, resolveLiveAddress } from './printers'
import type { PublicPrinterRecord } from './printers'
import { setAddressResolver } from './daemon-client/client'
import { watchPrintState, unwatchPrintState } from './daemon-client/feeds/print-state'
import { startMdnsScan, stopMdnsScan } from './mdns'
import { activeConnector, readSettings, writeSettings } from './git-host'
import { encryptionAvailable } from './git-host/keychain'
import type { ConnectionRequest } from './git-host/connector'
import { checkDaemonRecord } from './daemon-client/status'
import { registerPrinterOperationHandlers } from './ops/printer-ops'
import { registerAccessHandlers } from './ops/access-ops'
import { checkWriteLayer } from './ops/daemon-ops'
import { registerStoreHandlers } from './store/handlers'
import { reportRenderFailure } from './analytics/errors'
import { setAnalyticsConsent, usageReportingConsent } from './analytics/consent'
import { runStoreUninstall } from './store/uninstall'
import { freshestListedVersion } from './store/listed-version'
import { buildSession } from './dev-tools/patch-engine'
import { applyPatch } from './dev-tools/patch-apply'
import type { ApplyRequest } from './dev-tools/types'
import { loadCatalog } from './registry'
import { offerListingRefresh } from './registry/listing-freshness'
import { refreshListing } from './registry/listing-refresh'
import { readAssetStat, readReleaseDoc } from './registry/asset-read'
import { addLocalPackages, readLocalDoc, removeLocalPackage, userLocalSourceUrl } from './registry/local'
import {
  installAppUpdate,
  openAppDownloadPage,
  checkForUpdatesNow,
  downloadAppUpdate,
  reconfigureUpdates,
  listAppReleases,
  rollbackToRelease,
  consumeAppliedUpdate,
} from './app-update'
export type { PluginProgressEvent } from './store/progress'

function serializeAdapter(def: ReturnType<typeof getAdapter>): AdapterInfo | null {
  if (!def) return null

  return {
    id: def.id, title: def.title, vendor: def.vendor, version: def.version, jinniVersion: def.jinniVersion,
    description: def.description, icon: def.icon, defaults: def.defaults, envVars: def.envVars,
    enrollSteps: def.enrollSteps.map((step) => ({ id: step.id, label: step.label, detail: step.detail })),
  }
}

function registerKeyHandlers(): void {
  ipcMain.handle('keys:list', () => listKeys())
  ipcMain.handle('keys:generate', (_ev, opts) => generateKey(opts))
  ipcMain.handle('keys:remove', (_ev, id) => removeKey(id))
  ipcMain.handle('keys:export', (_ev, id) => exportPublicKey(id))
  ipcMain.handle('keys:exportPrivate', (_ev, id) => exportPrivateKey(id))
  ipcMain.handle('keys:setDefault', (_ev, id) => setDefault(id))
  ipcMain.handle('keys:setAssignments', (_ev, id, assignments) => setAssignments(id, assignments))
  ipcMain.handle('keys:setIcon', (_ev, id, color, image, size) => setKeyIcon(id, color, image, size))
  ipcMain.handle('keys:setPublishedAt', (_ev, id: string, date: string | null) => setPublishedAt(id, date))
}

function registerPrinterHandlers(getMainWindow: () => BrowserWindow): void {
  ipcMain.handle('printers:load', () => loadPublicPrinters())
  ipcMain.handle('printers:save', (_ev, record: PublicPrinterRecord) => savePrinter(record))
  // Field-level merge so a renderer write touches only the named fields and can never clobber a
  // daemon credential it does not hold. Returns nothing: the merged record carries the secrets, and
  // the renderer updates its own state optimistically.
  ipcMain.handle('printers:patch', (_ev, id: string, fields: Partial<PublicPrinterRecord>): void => { updatePrinter(id, fields) })
  ipcMain.handle('printers:remove', (_ev, id) => removePrinter(id))
  ipcMain.handle('printers:ping', (_ev, ip) => pingPrinter(ip))
  ipcMain.handle('printers:checkSshOpen', (_ev, ip: string) => checkSshOpen(ip))
  // Any address a person typed into a plugin's config, checked from this computer before it is sent.
  ipcMain.handle('net:probeService', (_ev, host: string, port: number) => probeService(host, port))
  ipcMain.handle('net:probeServiceUrl', (_ev, address: string) => probeServiceUrl(address))
  ipcMain.handle('printers:checkWriteLayer', (_ev, printerId: string) => checkWriteLayer(printerId))
  ipcMain.handle('printers:checkDaemon', (_ev, printerId: string) => checkDaemonRecord(printerId))
  ipcMain.handle('printers:watchPrintState', (_ev, printerId: string) =>
    watchPrintState(printerId, (event) => {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) win.webContents.send('printer:printState', event)
    })
  )
  ipcMain.handle('printers:unwatchPrintState', (_ev, printerId: string) => unwatchPrintState(printerId))
  ipcMain.handle('printers:adapter:get', (_ev, id: string) => serializeAdapter(getAdapter(id)))
  ipcMain.handle('printers:adapters:list', () => listAdapters().map((def) => serializeAdapter(def)))
  ipcMain.handle('printers:checkSsh', (_ev, ip: string, user: string, password: string, port: number) =>
    checkSsh(ip, { user, password, port })
  )
  ipcMain.handle(
    'printers:enroll',
    async (_ev, printerId: string, ip: string, adapterId: string, user: string, password: string, port: number, retryFromStepId?: string) => {
      const result = await enrollPrinter(getMainWindow(), printerId, ip, adapterId, { user, password, port }, retryFromStepId)
      // Record the true daemon version (and installed list / drift) right away instead of waiting for
      // the first status ping. Reuses the bounded status fetch; a no-op if the daemon is unreachable.
      await checkDaemonRecord(printerId).catch(() => undefined)

      return result
    }
  )
}

function registerGitHostHandlers(): void {
  ipcMain.handle('git-host:settings', () => readSettings())
  ipcMain.handle('git-host:settings:write', (_ev, settings) => writeSettings(settings))
  ipcMain.handle('git-host:isConnected', () => activeConnector().isConnected())
  ipcMain.handle('git-host:storageEncrypted', () => encryptionAvailable())
  ipcMain.handle('git-host:getTokenInfo', () => activeConnector().getTokenInfo())
  ipcMain.handle('git-host:getAccount', () => activeConnector().getAccount())
  ipcMain.handle('git-host:beginConnect', (_ev, pat?: string) => activeConnector().beginConnect(pat))
  ipcMain.handle('git-host:waitForAuth', (_ev, request: ConnectionRequest) => activeConnector().waitForAuthorization(request))
  ipcMain.handle('git-host:disconnect', () => activeConnector().disconnect())
  ipcMain.handle('git-host:createRepo', (_ev, name: string, description: string, isPrivate?: boolean, owner?: string) =>
    activeConnector().createRepo(name, description, isPrivate, owner)
  )
  ipcMain.handle('git-host:listRepos', () => activeConnector().listRepos())
  ipcMain.handle('git-host:listOrgs', () => activeConnector().listOrgs())
  ipcMain.handle('git-host:getFile', (_ev, owner: string, repo: string, path: string) => activeConnector().getFile({ owner, repo }, path))
  ipcMain.handle('git-host:putFile', (_ev, owner: string, repo: string, path: string, content: string, message: string, sha?: string) =>
    activeConnector().putFile({ owner, repo }, path, content, message, sha)
  )
  ipcMain.handle('git-host:deleteFile', (_ev, owner: string, repo: string, path: string, message: string, sha: string) =>
    activeConnector().deleteFile({ owner, repo }, path, message, sha)
  )
  ipcMain.handle('git-host:openPr', (_ev, owner: string, repo: string, opts) => activeConnector().openPullRequest({ owner, repo }, opts))
  ipcMain.handle('git-host:createRelease', (_ev, owner: string, repo: string, opts) => activeConnector().createRelease({ owner, repo }, opts))
  ipcMain.handle('git-host:uploadAsset', (_ev, owner: string, repo: string, releaseId: string, name: string, data: Buffer) =>
    activeConnector().uploadReleaseAsset({ owner, repo }, releaseId, name, data)
  )
  ipcMain.handle('git-host:publishRelease', (_ev, owner: string, repo: string, releaseId: string) => activeConnector().publishRelease({ owner, repo }, releaseId))
  ipcMain.handle('git-host:listReleases', (_ev, owner: string, repo: string) => activeConnector().listReleases({ owner, repo }))
}

function registerRegistryHandlers(): void {
  ipcMain.handle('registry:catalog', () => loadCatalog())
  ipcMain.handle('registry:setSourceEnabled', (_event, url: string, enabled: boolean) => {
    setSourceEnabled(url, enabled)

    return loadCatalog()
  })
  ipcMain.handle('registry:setChannelEnabled', (_event, channel: ReleaseChannel, enabled: boolean) =>
    setChannelEnabled(channel, enabled),
  )
  ipcMain.handle('registry:assetInfo', (_event, url: string) => readAssetStat(url))
  // A doc published with a release is a release asset like the .b3 is, and a visitor reads it without an
  // account. Neither of these two can reject: both are opened by simply looking at a plugin, and a
  // rejection here is a stack trace in the log on every click that tells nobody anything.
  ipcMain.handle('registry:releaseDoc', (_event, url: string) => readReleaseDoc(url))
  ipcMain.handle('registry:freshestVersion', (_event, pluginId: string, sourceUrl?: string) =>
    freshestListedVersion(pluginId, sourceUrl),
  )
  ipcMain.handle('registry:refreshOffer', () => offerListingRefresh())
  ipcMain.handle('registry:refreshListing', () => refreshListing())
}

// Ingest side of the user-local registry. local-store owns the files; this is thin glue that returns
// the fresh catalog so the renderer can refresh. Removal (which may also touch printers) is its own
// orchestration, kept out of here on purpose.
// Which managed printers have this plugin installed FROM the sideloaded source, and whether any other
// (bundled/online) source still offers it. The renderer uses this to explain the removal consequences.
// This is the only place that composes local-store with printers + catalog; local-store stays a leaf.
async function localRemoveContext(pluginId: string): Promise<{ printers: { id: string; nick: string }[]; hasOtherSource: boolean }> {
  const localUrl = userLocalSourceUrl()
  const printers = loadPrinters()
    .filter((record) => record.status === 'managed' && record.installedSources?.[pluginId] === localUrl)
    .map((record) => ({ id: record.id, nick: record.nick }))
  const entry = (await loadCatalog()).plugins.find((plugin) => plugin.name === pluginId)
  const hasOtherSource = !!entry && (entry.variants ?? [entry]).some((variant) => variant.registry_url !== localUrl)

  return { printers, hasOtherSource }
}

async function runLocalRemove(win: BrowserWindow, pluginId: string, uninstallFrom: string[]): Promise<void> {
  await Promise.all(uninstallFrom.map((printerId) => runStoreUninstall(win, printerId, pluginId)))
  removeLocalPackage(pluginId)
}

function registerLocalStoreHandlers(getMainWindow: () => BrowserWindow): void {
  // addLocalPackages writes the index synchronously, so a follow-up registry:catalog re-read by the
  // renderer sees the new package. We return only the per-file result (added / errors), not the catalog.
  ipcMain.handle('localStore:add', (_event, paths: string[]) => addLocalPackages(paths))
  ipcMain.handle('localStore:doc', (_event, id: string, relativePath: string) => readLocalDoc(id, relativePath))
  ipcMain.handle('localStore:removeContext', (_event, id: string) => localRemoveContext(id))
  ipcMain.handle('localStore:remove', (_event, id: string, uninstallFrom: string[]) => runLocalRemove(getMainWindow(), id, uninstallFrom))
}

function registerDevToolsHandlers(): void {
  ipcMain.handle(
    'devtools:patch:session',
    (_ev, patchId: string, targetId: string, targetName: string, targetContent: string, patchContent: string) =>
      buildSession(patchId, { id: targetId, name: targetName, content: targetContent }, patchContent),
  )

  ipcMain.handle(
    'devtools:patch:apply',
    (_ev, req: ApplyRequest, targetContent: string, hunksJson: string) => {
      const hunks = JSON.parse(hunksJson)

      return applyPatch(targetContent, req, hunks)
    },
  )
}

function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:set', (_ev, patch: Partial<AppSettings>) => saveSettings(patch))
}

function registerAppUpdateHandlers(getMainWindow: () => BrowserWindow): void {
  ipcMain.handle('app-update:installNow', () => installAppUpdate())
  ipcMain.handle('app-update:openDownload', (_ev, url: string) => openAppDownloadPage(url))
  ipcMain.handle('app-update:checkNow', () => checkForUpdatesNow(getMainWindow))
  ipcMain.handle('app-update:download', () => downloadAppUpdate())
  ipcMain.handle('app-update:reconfigure', () => reconfigureUpdates(getMainWindow))
  ipcMain.handle('app-update:listReleases', () => listAppReleases())
  ipcMain.handle('app-update:rollback', (_ev, tag: string) => rollbackToRelease(tag))
  ipcMain.handle('app-update:consumeApplied', () => consumeAppliedUpdate())
}

export function registerIpc(getMainWindow: () => BrowserWindow): void {
  // Teach the daemon transport how to find a printer that moved, so a flip-flopping DHCP lease never
  // fails a daemon call: it re-resolves the live address and retries. Wired once at startup.
  setAddressResolver(resolveLiveAddress)
  ipcMain.handle('shell:openUrl', (_ev, url: string) => shell.openExternal(url))
  ipcMain.handle('mdns:start', () => startMdnsScan(getMainWindow()))
  ipcMain.handle('mdns:stop', () => stopMdnsScan())
  registerSettingsHandlers()
  registerAppUpdateHandlers(getMainWindow)
  registerAccessHandlers()
  registerKeyHandlers()
  registerPrinterHandlers(getMainWindow)
  registerPrinterOperationHandlers(getMainWindow)
  registerGitHostHandlers()
  registerStoreHandlers(getMainWindow)
  registerRegistryHandlers()
  registerLocalStoreHandlers(getMainWindow)
  registerDevToolsHandlers()
  registerAnalyticsHandlers()
}

// The window's one line to usage reporting. It hands over a class name and nothing else, and main
// decides what that becomes: reportRenderFailure cleans the string and pins the area itself.
//
// Consent is written here rather than through settings:set on purpose: the answer is the one thing
// that decides whether anything is sent at all, so it is written through the analytics code that
// reads it rather than through the general settings door any window can push a value through.
function registerAnalyticsHandlers(): void {
  ipcMain.handle('analytics:renderFailure', (_ev, errorClass) => reportRenderFailure(errorClass))
  ipcMain.handle('analytics:consent', () => usageReportingConsent())
  ipcMain.handle('analytics:setConsent', (_ev, granted: boolean) => setAnalyticsConsent(granted))
}
