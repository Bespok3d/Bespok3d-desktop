// The `github:owner/repo/path` scheme. Public-first through the contents API with NO token, then the
// user's connected token for a private list: a user who has not connected a git host can still browse
// public lists, and public repos stay CDN-cheap.
import { RegistryFetchError } from '../model'
import type { RegistryRef, ServedIndex, FetchedRegistry } from '../model'
import { loadCache, conditionalHeaders } from './cache'
import { httpGet, httpFailure, fetchSignatureBeside } from './request'
import { toFetchedRegistry, cacheServedIndex, withRetriedSignature } from './served-index'
import { activeConnector } from '../../git-host'

const GITHUB_REGISTRY_URL = /^github:([^/]+)\/([^/]+)\/(.+)$/
const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_RAW_HEADERS = { Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' }

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

// Whether the bytes came off the cache travels WITH them: a caller that assumed 'fresh' would tell the
// user a list had just been re-read when it had not, and the staleness of a list is exactly what the
// user is deciding on.
interface ResolvedIndex {
  served: ServedIndex
  fromCache: boolean
}

async function resolveGitHubIndex(list: GitHubListRef): Promise<ResolvedIndex> {
  const open = await fetchGitHubPublic(list)
  if (open) return open

  return { served: await fetchGitHubAuthorized(list), fromCache: false }
}

function contentsUrl(list: GitHubListRef): string {
  return `${GITHUB_API_BASE}/repos/${list.owner}/${list.repo}/contents/${list.path}`
}

// A 401/403/404 (private, rate-limited, or missing) returns null so the caller falls back to the
// authenticated path; only a transport failure is hard. Conditional GET keeps the 60/hr anonymous
// budget intact.
async function fetchGitHubPublic(list: GitHubListRef): Promise<ResolvedIndex | null> {
  const cacheKey = `github:${list.owner}/${list.repo}/${list.path}`
  const cached = loadCache().get(cacheKey)
  const url = contentsUrl(list)
  const response = await httpGet(url, { ...conditionalHeaders(cached), ...GITHUB_RAW_HEADERS })
  if (response.status === 304 && cached) {
    return { served: await withRetriedSignature(cacheKey, cached, () => fetchSignatureBeside(url, GITHUB_RAW_HEADERS)), fromCache: true }
  }

  return servedGitHubIndex(cacheKey, list, response.status === 304 ? await httpGet(url, GITHUB_RAW_HEADERS) : response)
}

async function servedGitHubIndex(cacheKey: string, list: GitHubListRef, response: Response): Promise<ResolvedIndex | null> {
  if (response.status === 401 || response.status === 403 || response.status === 404) return null
  if (!response.ok) throw httpFailure(response.status, 'GitHub')
  const served = { bytes: await response.text(), signature: await fetchSignatureBeside(contentsUrl(list), GITHUB_RAW_HEADERS) }
  cacheServedIndex(cacheKey, served, response)

  return { served, fromCache: false }
}

function authFallbackError(error: Error): never {
  if (/not connected/i.test(error.message)) {
    throw new RegistryFetchError('auth', 'Sign in to GitHub in Settings > Git Host to load this private list')
  }
  throw new RegistryFetchError('network', error.message)
}

// Authenticated fallback for a private list: the user's git-host token. A missing connection is an
// actionable 'auth' failure (sign in), a 404 is 'notfound' (gone, or the user lacks access).
async function fetchGitHubAuthorized(list: GitHubListRef): Promise<ServedIndex> {
  const repoRef = { owner: list.owner, repo: list.repo }
  const connector = activeConnector()
  const file = await connector.getFile(repoRef, list.path).catch(authFallbackError)
  if (!file) throw new RegistryFetchError('notfound', 'Not found, or you do not have access to this private list')
  const signatureFile = await connector.getFile(repoRef, `${list.path}.sig`).catch(() => null)

  return { bytes: file.content, signature: signatureFile?.content ?? null }
}
