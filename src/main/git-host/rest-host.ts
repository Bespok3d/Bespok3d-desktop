import { load, clear } from './keychain'
import { mapRelease, mapRepo } from './mappers'
import type { GitHostAccount, RepoRef, RepoInfo, FileContent, PrOptions, PrInfo, ReleaseOptions, ReleaseInfo, AssetInfo } from './connector'

export type JsonObject = Record<string, unknown>

// The host-specific surface of a REST git host (GitHub or Gitea). Everything NOT captured here - the
// transport, content ops, repo ops, release ops - is identical between the two and lives once in this
// file, driven by the profile. A new host (or swapping the regime default to GitHub) is a new profile,
// not a new copy of the call logic. The genuinely divergent pieces (auth/connect flow, getTokenInfo,
// assetInfo) stay in the host module and are composed onto the shared core in createXConnector.
export interface RestHostProfile {
  label: string
  keychainKey: string
  apiBase: string
  requestHeaders(token: string, withBody: boolean): Record<string, string>
  mapAsset(raw: JsonObject): AssetInfo
  accountName(raw: JsonObject): string
  listReposQuery: string
  listOrgsPath: string
  orgName(raw: JsonObject): string
  newRepoBody(name: string, description: string, isPrivate: boolean): JsonObject
  contentCreateMethod: 'POST' | 'PUT'
  listReleasesQuery: string
  uploadAssetUrl(repo: RepoRef, releaseId: string, encodedName: string): string
  uploadAssetHeaders(token: string): Record<string, string>
  downloadAssetHeaders(token: string): Record<string, string>
}

function makeRestTransport(profile: RestHostProfile, getToken: () => string) {
  function headers(withBody: boolean): Record<string, string> { return profile.requestHeaders(getToken(), withBody) }
  async function apiGet(path: string): Promise<JsonObject | null> {
    const response = await fetch(`${profile.apiBase}${path}`, { headers: headers(false) })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`${profile.label} GET ${path}: ${response.status}`)

    return response.json() as Promise<JsonObject>
  }
  async function apiGetArray(path: string): Promise<JsonObject[]> {
    const response = await fetch(`${profile.apiBase}${path}`, { headers: headers(false) })
    if (!response.ok) throw new Error(`${profile.label} GET ${path}: ${response.status}`)

    return response.json() as Promise<JsonObject[]>
  }
  async function apiSend(method: string, path: string, body: unknown): Promise<JsonObject> {
    const response = await fetch(`${profile.apiBase}${path}`, { method, headers: headers(true), body: JSON.stringify(body) })
    if (!response.ok) throw new Error(`${profile.label} ${method} ${path}: ${response.status}`)

    return response.json() as Promise<JsonObject>
  }
  async function apiDelete(path: string, body?: unknown): Promise<void> {
    const response = await fetch(`${profile.apiBase}${path}`, { method: 'DELETE', headers: headers(!!body), body: body ? JSON.stringify(body) : undefined })
    if (!response.ok && response.status !== 204) throw new Error(`${profile.label} DELETE ${path}: ${response.status}`)
  }

  return { apiGet, apiGetArray, apiSend, apiDelete }
}

type RestTransport = ReturnType<typeof makeRestTransport>

function makeRestAccountOps(profile: RestHostProfile) {
  var cachedUsername: string | null = null

  function requireToken(): string {
    const token = load(profile.keychainKey)
    if (!token) throw new Error(`Not connected to ${profile.label}`)

    return token
  }

  const transport = makeRestTransport(profile, requireToken)

  async function whoami(): Promise<string> {
    if (cachedUsername) return cachedUsername
    const data = await transport.apiGet('/user')
    if (!data) throw new Error(`${profile.label} /user returned 404`)
    cachedUsername = String(data.login)

    return cachedUsername
  }

  async function getAccount(): Promise<GitHostAccount | null> {
    if (!load(profile.keychainKey)) return null
    const data = await transport.apiGet('/user')
    if (!data) return null

    return { login: String(data.login), name: profile.accountName(data) }
  }

  async function disconnect(): Promise<void> { clear(profile.keychainKey); cachedUsername = null }
  async function isConnected(): Promise<boolean> { return load(profile.keychainKey) !== null }

  return { requireToken, transport, whoami, getAccount, disconnect, isConnected }
}

function makeRestContentOps(profile: RestHostProfile, transport: RestTransport) {
  async function getFile(repo: RepoRef, path: string): Promise<FileContent | null> {
    const data = await transport.apiGet(`/repos/${repo.owner}/${repo.repo}/contents/${path}`)
    if (!data) return null

    return { content: Buffer.from(String(data.content).replace(/\n/g, ''), 'base64').toString('utf-8'), sha: String(data.sha) }
  }

  async function putFile(repo: RepoRef, path: string, content: string, message: string, sha?: string): Promise<void> {
    const body = { message, content: Buffer.from(content, 'utf-8').toString('base64'), ...(sha ? { sha } : {}) }
    const method = sha ? 'PUT' : profile.contentCreateMethod
    await transport.apiSend(method, `/repos/${repo.owner}/${repo.repo}/contents/${path}`, body)
  }

  async function deleteFile(repo: RepoRef, path: string, message: string, sha: string): Promise<void> {
    await transport.apiDelete(`/repos/${repo.owner}/${repo.repo}/contents/${path}`, { message, sha })
  }

  async function openPullRequest(repo: RepoRef, opts: PrOptions): Promise<PrInfo> {
    const data = await transport.apiSend('POST', `/repos/${repo.owner}/${repo.repo}/pulls`, { title: opts.title, body: opts.body, head: opts.head, base: opts.base })

    return { number: Number(data.number), url: String(data.html_url) }
  }

  return { getFile, putFile, deleteFile, openPullRequest }
}

// Create a repo, translating an org-permission failure (403/404) into a clear message.
async function postNewRepo(transport: RestTransport, path: string, target: string, self: string, body: JsonObject): Promise<JsonObject> {
  try {
    return await transport.apiSend('POST', path, body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (target !== self && /\b(403|404)\b/.test(message)) {
      throw new Error(`No permission to create a repository under "${target}". You must be a member of that organization with repository-creation rights.`, { cause: error })
    }
    throw error
  }
}

function makeRestRepoOps(profile: RestHostProfile, transport: RestTransport, whoami: () => Promise<string>) {
  async function createRepo(name: string, description: string, isPrivate = false, owner?: string): Promise<RepoInfo> {
    const self = await whoami()
    const target = owner || self
    const existing = await transport.apiGet(`/repos/${target}/${name}`)
    if (existing) return mapRepo(existing, false)
    const path = target === self ? '/user/repos' : `/orgs/${target}/repos`
    const created = await postNewRepo(transport, path, target, self, profile.newRepoBody(name, description, isPrivate))

    return mapRepo(created, true)
  }

  async function listRepos(): Promise<RepoInfo[]> {
    const repos = await transport.apiGetArray(`/user/repos${profile.listReposQuery}`)

    return repos.map((raw) => mapRepo(raw, false))
  }

  async function listOrgs(): Promise<string[]> {
    const orgs = await transport.apiGetArray(profile.listOrgsPath)

    return orgs.map((org) => profile.orgName(org))
  }

  return { createRepo, listRepos, listOrgs }
}

function makeRestReleaseOps(profile: RestHostProfile, transport: RestTransport, getToken: () => string) {
  async function createRelease(repo: RepoRef, opts: ReleaseOptions): Promise<ReleaseInfo> {
    const data = await transport.apiSend('POST', `/repos/${repo.owner}/${repo.repo}/releases`, { tag_name: opts.tag, name: opts.title, body: opts.body ?? '', draft: opts.draft ?? true })

    return mapRelease(data, profile.mapAsset)
  }

  async function uploadReleaseAsset(repo: RepoRef, releaseId: string, name: string, data: Buffer): Promise<AssetInfo> {
    const response = await fetch(profile.uploadAssetUrl(repo, releaseId, encodeURIComponent(name)), { method: 'POST', headers: profile.uploadAssetHeaders(getToken()), body: data })
    if (!response.ok) throw new Error(`${profile.label} upload asset: ${response.status}`)

    return profile.mapAsset((await response.json()) as JsonObject)
  }

  async function publishRelease(repo: RepoRef, releaseId: string): Promise<void> {
    await transport.apiSend('PATCH', `/repos/${repo.owner}/${repo.repo}/releases/${releaseId}`, { draft: false })
  }

  async function listReleases(repo: RepoRef): Promise<ReleaseInfo[]> {
    const releases = await transport.apiGetArray(`/repos/${repo.owner}/${repo.repo}/releases${profile.listReleasesQuery}`)

    return releases.map((raw) => mapRelease(raw, profile.mapAsset))
  }

  async function downloadReleaseAsset(url: string): Promise<Buffer> {
    const response = await fetch(url, { headers: profile.downloadAssetHeaders(getToken()) })
    if (!response.ok) throw new Error(`${profile.label} download asset: ${response.status}`)

    return Buffer.from(await response.arrayBuffer())
  }

  return { createRelease, uploadReleaseAsset, publishRelease, listReleases, downloadReleaseAsset }
}

// The host-agnostic half of a GitHostConnector (every method except the host-specific
// beginConnect/waitForAuthorization/getTokenInfo/assetInfo). The host module spreads this and adds
// those four, so the per-host connector assembly stays a one-liner and is never copy-pasted.
export function makeRestHost(profile: RestHostProfile) {
  const account = makeRestAccountOps(profile)

  return {
    getAccount: account.getAccount,
    disconnect: account.disconnect,
    isConnected: account.isConnected,
    ...makeRestContentOps(profile, account.transport),
    ...makeRestRepoOps(profile, account.transport, account.whoami),
    ...makeRestReleaseOps(profile, account.transport, account.requireToken),
  }
}
