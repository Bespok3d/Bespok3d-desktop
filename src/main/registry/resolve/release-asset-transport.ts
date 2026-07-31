// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The `<host>/<owner>/<repo>/releases/latest/download/<asset>` shape: a list published as an asset of
// its own repo's latest release, which is how a publisher ships a list without committing it anywhere.
// Public-first exactly like the contents transport - the plain download url, no credentials, CDN-cheap
// - then the user's connected token, because that same url answers 404 on a PRIVATE repo even for the
// account that owns it. So one registered ref serves a public publisher and a private one alike.
//
// The token path finds the asset BY NAME off the repo's latest release, never by asset id: an id is
// minted fresh by every release, and a ref carrying one would have to be re-registered in the
// index-of-lists on every publish.
import { RegistryFetchError } from '../model'
import type { RegistryRef, ServedIndex, FetchedRegistry } from '../model'
import { connectorFailure } from './request'
import { isHttpUrl } from './http-transport'
import { firstOpenAvenue, connectedToAGitHost } from './anonymous-avenues'
import { toFetchedRegistry } from './served-index'
import { activeConnector } from '../../git-host'
import type { AssetInfo, ReleaseInfo } from '../../git-host/connector'

const RELEASE_DOWNLOAD_URL = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/releases\/latest\/download\/([^/?#]+)$/
const SIGNATURE_SUFFIX = '.sig'
const NO_ACCESS = 'Not found, or you do not have access to this private list'

export interface ReleaseAssetListRef {
  owner: string
  repo: string
  assetName: string
}

// Null means "not this transport", which is what lets the router pick on the ref alone.
export function toReleaseAssetListRef(url: string): ReleaseAssetListRef | null {
  const match = isHttpUrl(url) ? RELEASE_DOWNLOAD_URL.exec(url) : null
  if (!match) return null

  return { owner: match[1], repo: match[2], assetName: match[3] }
}

// The download url is the one anonymous avenue this shape has: it already resolves `/releases/latest/`
// on its own and carries no request ration. The token is tried only when the user actually has one -
// a private repo answers this url with 404 for everyone, owner included - and when he has not, the
// anonymous failure is what he is told, because "sign in to read this private list" is a dead end for
// someone whose real problem is an offline machine or a rationed IP.
export async function fetchReleaseAssetRegistry(ref: RegistryRef, list: ReleaseAssetListRef): Promise<FetchedRegistry> {
  const walk = await firstOpenAvenue([ref.url])
  if (walk.resolved) return toFetchedRegistry(ref, walk.resolved.served, walk.resolved.fromCache)
  if (!(await connectedToAGitHost())) throw walk.failure ?? new RegistryFetchError('notfound', NO_ACCESS)

  return toFetchedRegistry(ref, await servedToTheToken(list), false)
}

// Matched by name because a release carries one asset per published file: picking any other one would
// hand this list another file's bytes. The `.sig` beside it is optional, exactly as it is over http -
// most lists are unsigned, and an unsigned one still loads.
async function servedToTheToken(list: ReleaseAssetListRef): Promise<ServedIndex> {
  const release = await latestPublishedRelease(list)
  const index = assetNamed(release, list.assetName)
  if (!index) throw new RegistryFetchError('notfound', NO_ACCESS)
  const signature = assetNamed(release, `${list.assetName}${SIGNATURE_SUFFIX}`)

  return { bytes: await downloadedAsset(index), signature: signature ? await downloadedAsset(signature).catch(() => null) : null }
}

function assetNamed(release: ReleaseInfo, name: string): AssetInfo | null {
  return release.assets.find((asset) => asset.name === name) ?? null
}

function downloadedAsset(asset: AssetInfo): Promise<string> {
  return activeConnector().downloadReleaseAsset(asset.downloadUrl).then((bytes) => bytes.toString('utf8'))
}

// What `releases/latest` means, resolved through the connector so it holds on any host the user can
// connect. A prerelease is skipped for the reason the download url skips it: the store must not be
// moved forward by a build the publisher has not blessed.
async function latestPublishedRelease(list: ReleaseAssetListRef): Promise<ReleaseInfo> {
  const releases = await activeConnector().listReleases({ owner: list.owner, repo: list.repo }).catch(connectorFailure)
  const published = releases.find((release) => !release.prerelease)
  if (!published) throw new RegistryFetchError('notfound', NO_ACCESS)

  return published
}
