// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Ask a plugin's own repo what it last released, with no token, so a publisher shipping a fix reaches
// the store without the org republishing anything. Public-first exactly like the list read: the
// releases API with no credentials, an ETag conditional against the shared registry cache, and null
// for every unhappy answer (no release, private, rate-limited, unparsable) because a refresh that
// cannot answer must leave the listed entry exactly as it was rather than fail the store.
//
// THE VERSION AND THE URL COME FROM THE SAME ASSET. The version is read out of the asset's own
// filename rather than the release tag, so the number the store shows and the bytes an install
// fetches cannot disagree: a tag saying 0.2.0 over an asset built at 0.1.9 would raise the listed
// version and make every install of that plugin refuse as older-than-listed.
import { loadCache, conditionalHeaders, writeCache } from './cache'
import { httpGet } from './request'
import { recordReleaseAsk, releaseAskAllowed } from './release-asks'
import type { PublishingRepo } from './publishing-repo'

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_JSON_HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
// A `.b3` asset is named `<plugin id>-<version>.b3` by the builder. Anything else in the release (a
// checksum file, a hand-uploaded archive, a renamed build) carries no version this can trust.
const PACKAGE_SUFFIX = '.b3'
const VERSION_SHAPE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

export interface FreshRelease {
  version: string
  downloadUrl: string
}

interface ReleaseAsset {
  name?: unknown
  url?: unknown
}

interface ReleasePayload {
  assets?: ReleaseAsset[]
}

// `releases/latest` and not `releases`: it is one request, it never answers with a draft, and it skips
// prereleases, so the store cannot be moved forward by a build the publisher has not blessed.
function latestReleaseUrl(repo: PublishingRepo): string {
  return `${GITHUB_API_BASE}/repos/${repo.owner}/${repo.repo}/releases/latest`
}

// Namespaced apart from the list cache: these bytes are a release payload, not a served index, and
// nothing may ever read one as the other.
function releaseCacheKey(repo: PublishingRepo): string {
  return `github-release:${repo.owner}/${repo.repo}`
}

function versionInAssetName(assetName: string, pluginId: string): string | null {
  const prefix = `${pluginId}-`
  if (!assetName.startsWith(prefix) || !assetName.endsWith(PACKAGE_SUFFIX)) return null
  const version = assetName.slice(prefix.length, assetName.length - PACKAGE_SUFFIX.length)

  return VERSION_SHAPE.test(version) ? version : null
}

function releaseFromAsset(asset: ReleaseAsset, pluginId: string): FreshRelease | null {
  if (typeof asset.name !== 'string' || typeof asset.url !== 'string') return null
  const version = versionInAssetName(asset.name, pluginId)

  return version ? { version, downloadUrl: asset.url } : null
}

function parseRelease(bytes: string): ReleasePayload | null {
  try {
    return JSON.parse(bytes) as ReleasePayload
  } catch {
    return null
  }
}

// The plugin's OWN package in that release, by name. A co-repo release carries one asset per plugin it
// ships, so picking any `.b3` would hand one plugin another plugin's payload.
function packagedRelease(bytes: string, pluginId: string): FreshRelease | null {
  const payload = parseRelease(bytes)
  const assets = Array.isArray(payload?.assets) ? payload.assets : []

  return assets.map((asset) => releaseFromAsset(asset, pluginId)).find(Boolean) ?? null
}

function cacheRelease(repo: PublishingRepo, bytes: string, response: Response): void {
  writeCache(releaseCacheKey(repo), {
    bytes,
    signature: null,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    fetchedAt: Date.now(),
  })
}

// THE ONE PLACE A RELEASE REQUEST IS MADE, which is why the per-hour cap is spent here: no caller can
// ask past it, and a caller that finds the cap spent is answered from the cache instead, because what
// was last learned is a better answer than nothing.
//
// It hands back the bytes the repo served rather than one plugin's asset, so a co-repo release costs
// ONE ask for every plugin it ships: the pass asks once per repo and each of that repo's plugins reads
// its own asset out of those cached bytes.
export async function askLatestRelease(repo: PublishingRepo): Promise<string | null> {
  const cached = loadCache().get(releaseCacheKey(repo))
  if (!releaseAskAllowed()) return cached?.bytes ?? null
  recordReleaseAsk(repo)
  const response = await httpGet(latestReleaseUrl(repo), { ...conditionalHeaders(cached), ...GITHUB_JSON_HEADERS }).catch(() => null)
  if (!response) return null
  if (response.status === 304) return cached?.bytes ?? null
  if (!response.ok) return null
  const bytes = await response.text().catch(() => null)
  // Filed whenever the answer WAS a release, even when this plugin has no asset in it: the bytes belong
  // to the repo, and a sibling plugin in the same co-repo release must not have to pay a second ask.
  if (bytes === null || !parseRelease(bytes)) return null
  cacheRelease(repo, bytes, response)

  return bytes
}

export async function fetchLatestRelease(repo: PublishingRepo, pluginId: string): Promise<FreshRelease | null> {
  const bytes = await askLatestRelease(repo)

  return bytes === null ? null : packagedRelease(bytes, pluginId)
}

// What this repo was last known to have released, with no request at all. Every catalog read goes
// through this, so the listing costs nothing to show; only the refresh pass and an opened page ask.
export function cachedRelease(repo: PublishingRepo, pluginId: string): FreshRelease | null {
  const cached = loadCache().get(releaseCacheKey(repo))

  return cached ? packagedRelease(cached.bytes, pluginId) : null
}
