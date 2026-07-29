// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { join, dirname } from 'path'
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync, rmSync } from 'fs'
import { userDataPath } from '../app-paths'
import { activeConnector } from '../git-host'
import type { ReleaseChannel } from '../settings'
import type { MergedEntry } from '../registry/model'

export function findCatalogEntry(plugins: readonly MergedEntry[], pluginId: string): MergedEntry {
  const entry = plugins.find((candidate) => candidate.name === pluginId)
  if (!entry) throw new Error(`bundled plugin not found: ${pluginId}`)

  return entry
}

// The catalog entry for a plugin from a specific source (registry url) and/or channel, or the winner
// when neither is named or no variant matches. A variant's identity is registry_url x channel, so
// both narrow the pick: lets the user install/switch a plugin from a chosen source AND channel (e.g.
// the experiment build vs the published stable copy of the same plugin name).
export function findCatalogVariant(
  plugins: readonly MergedEntry[],
  pluginId: string,
  sourceUrl?: string,
  channel?: ReleaseChannel,
): MergedEntry {
  const winner = findCatalogEntry(plugins, pluginId)
  if (!sourceUrl && !channel) return winner
  const match = (winner.variants ?? []).find(
    (variant) => (!sourceUrl || variant.registry_url === sourceUrl) && (!channel || variant.channel === channel),
  )

  return match ?? winner
}

function pluginCachePath(entry: MergedEntry): string {
  return userDataPath('plugin-cache', `${entry.name}-${entry.version}.b3`)
}

// Throw away the downloaded copy of a package the app would not install, saying whether there was one.
// The download cache is keyed by plugin name and version, so a copy left behind is handed straight back
// to the next attempt at that version: the user would keep seeing the same refusal with no way to retry
// the download. Nothing else lives at that path, and a package that was never downloaded (a bundled one)
// has nothing there to delete, which is what the false answer means.
export function discardCachedArchive(entry: MergedEntry): boolean {
  const cachePath = pluginCachePath(entry)
  const wasCached = existsSync(cachePath)
  rmSync(cachePath, { force: true })

  return wasCached
}

// Read a bundled .b3 off disk, turning a non-file path into an actionable message. A .b3 unpacked in
// place for inspection leaves a directory where the file was, which readFileSync reports as a bare
// "EISDIR" the user cannot act on; say what is wrong and how to recover instead.
function readLocalArchive(archivePath: string): Buffer {
  const stat = statSync(archivePath, { throwIfNoEntry: false })
  if (!stat?.isFile()) {
    throw new Error(`bundled archive is not a file: ${archivePath} (was it unpacked in place? repack the bundle)`)
  }

  return readFileSync(archivePath)
}

// Resolve a catalog entry's install payload through the same download_url the federated loader
// records. The bundled list is on disk, so download_url is relative to the registry root and the
// bytes are read locally. A remote http(s) download_url is fetched through the git host (private
// release asset, authed) and cached by name-version. That key assumes the asset for a version never
// changes, which a re-released build at the same version breaks, so the cached copy is a guess and
// never the last word: whoever refuses it discards it (discardCachedArchive) and the next resolve
// downloads the asset as it stands now.
export async function resolveArchiveBytes(entry: MergedEntry): Promise<Buffer> {
  const downloadUrl = entry.download_url
  if (typeof downloadUrl !== 'string') throw new Error(`plugin entry missing download_url: ${entry.name}`)
  if (!/^https?:\/\//.test(downloadUrl)) return readLocalArchive(join(dirname(entry.registry_url), downloadUrl))
  const cachePath = pluginCachePath(entry)
  if (existsSync(cachePath)) return readFileSync(cachePath)
  const bytes = await activeConnector().downloadReleaseAsset(downloadUrl)
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, bytes)

  return bytes
}
