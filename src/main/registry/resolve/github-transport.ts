// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The `github:owner/repo/path` scheme, resolved down a ladder of avenues: the release asset, then the
// raw repo file, then - only for someone who actually signed in - the contents API. The API used to be
// the FIRST rung, which is what broke the store for anonymous users: it rations an anonymous caller to
// 60 requests an hour per IP, a catalog load costs about 22, and the third load of the day answered
// 403 to everything. The first two rungs carry no ration and no credentials, so a public list loads
// for someone with no GitHub account at all.
import { RegistryFetchError } from '../model'
import type { RegistryRef, ServedIndex, FetchedRegistry } from '../model'
import { connectorFailure } from './request'
import { firstOpenAvenue, connectedToAGitHost } from './anonymous-avenues'
import { toFetchedRegistry } from './served-index'
import type { ResolvedIndex } from './served-index'
import { activeConnector } from '../../git-host'

const GITHUB_REGISTRY_URL = /^github:([^/]+)\/([^/]+)\/(.+)$/
const RELEASE_DOWNLOAD_BASE = 'https://github.com'
const RAW_FILE_BASE = 'https://raw.githubusercontent.com'
// A contents request that names no branch is answered with the repo's DEFAULT branch, and every
// Bespok3d repo defaults to the working branch `dev`. A published list lives on main, so every read
// of one names main - otherwise the store shows whatever is mid-flight in the repo.
const PUBLISHED_BRANCH = 'main'
const NO_ACCESS = 'Not found, or you do not have access to this private list'

export interface GitHubListRef {
  owner: string
  repo: string
  path: string
}

// Null means "not this transport", which is what lets the entry point route on the ref alone.
export function toGitHubListRef(url: string): GitHubListRef | null {
  const match = GITHUB_REGISTRY_URL.exec(url)
  if (!match) return null

  return { owner: match[1], repo: match[2], path: match[3] }
}

export async function fetchGitHubRegistry(ref: RegistryRef, list: GitHubListRef): Promise<FetchedRegistry> {
  const resolved = await resolveGitHubIndex(list)

  return toFetchedRegistry(ref, resolved.served, resolved.fromCache)
}

// A release asset has no directory, so a ref naming a path publishes under its last segment.
function assetNamed(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

// Rung 1 is how a list is PUBLISHED (an asset of the repo's latest release) and rung 2 is how a
// `github:` ref pins one to a branch, so which one answers depends on the publisher, not on us. Going
// through `/releases/latest/` means the newest release is found by the url itself, with no API call
// spent discovering a version.
function anonymousAvenues(list: GitHubListRef): string[] {
  return [
    `${RELEASE_DOWNLOAD_BASE}/${list.owner}/${list.repo}/releases/latest/download/${assetNamed(list.path)}`,
    `${RAW_FILE_BASE}/${list.owner}/${list.repo}/${PUBLISHED_BRANCH}/${list.path}`,
  ]
}

async function resolveGitHubIndex(list: GitHubListRef): Promise<ResolvedIndex> {
  const walk = await firstOpenAvenue(anonymousAvenues(list))
  if (walk.resolved) return walk.resolved
  if (!(await connectedToAGitHost())) throw walk.failure ?? new RegistryFetchError('notfound', NO_ACCESS)

  return { served: await fetchGitHubAuthorized(list), fromCache: false }
}

// Rung 3, for a list no anonymous avenue serves: a private repo read with the user's own token. The
// signature url goes through the connector too - `${contentsUrl}.sig` would land the `.sig` on the ref
// query instead of the path, 404 silently, and leave every plugin in the list showing as unverifiable.
async function fetchGitHubAuthorized(list: GitHubListRef): Promise<ServedIndex> {
  const repoRef = { owner: list.owner, repo: list.repo }
  const connector = activeConnector()
  const file = await connector.getFile(repoRef, list.path, PUBLISHED_BRANCH).catch(connectorFailure)
  if (!file) throw new RegistryFetchError('notfound', NO_ACCESS)
  const signatureFile = await connector.getFile(repoRef, `${list.path}.sig`, PUBLISHED_BRANCH).catch(() => null)

  return { bytes: file.content, signature: signatureFile?.content ?? null }
}
