import { save } from '../keychain'
import { makeRestHost, type RestHostProfile, type JsonObject } from '../rest-host'
import type { GitHostConnector, TokenInfo, ConnectionRequest, AssetInfo } from '../connector'

const KEYCHAIN_KEY = 'gitea-token'

function mapAsset(raw: JsonObject): AssetInfo {
  return {
    id: String(raw.id),
    name: String(raw.name),
    downloadUrl: String(raw.browser_download_url),
    downloadCount: Number(raw.download_count ?? 0),
  }
}

function giteaProfile(apiBase: string): RestHostProfile {
  return {
    label: 'Gitea',
    keychainKey: KEYCHAIN_KEY,
    apiBase,
    requestHeaders: (token, withBody) => ({ Authorization: `token ${token}`, ...(withBody ? { 'Content-Type': 'application/json' } : {}) }),
    mapAsset,
    accountName: (raw) => String(raw.full_name || raw.login),
    listReposQuery: '?limit=50',
    listOrgsPath: '/user/orgs?limit=50',
    orgName: (raw) => String(raw.username ?? raw.name),
    newRepoBody: (name, description, isPrivate) => ({ name, description, private: isPrivate, auto_init: true }),
    // Gitea POSTs to create a new file and PUTs to update an existing one (vs GitHub's PUT for both).
    contentCreateMethod: 'POST',
    listReleasesQuery: '?limit=50',
    uploadAssetUrl: (repo, releaseId, encodedName) => `${apiBase}/repos/${repo.owner}/${repo.repo}/releases/${releaseId}/assets?name=${encodedName}`,
    uploadAssetHeaders: (token) => ({ Authorization: `token ${token}`, 'Content-Type': 'application/octet-stream' }),
    downloadAssetHeaders: (token) => ({ Authorization: `token ${token}` }),
  }
}

async function beginConnect(pat?: string): Promise<ConnectionRequest> {
  if (!pat) throw new Error('Gitea requires a personal access token')
  save(KEYCHAIN_KEY, pat)

  return { type: 'pat', expiresAt: new Date('2099-01-01') }
}

async function waitForAuthorization(_request: ConnectionRequest): Promise<void> {
  // PAT is already stored by beginConnect; nothing to poll
}

async function getTokenInfo(): Promise<TokenInfo> {
  return { type: 'pat', scopes: [], expiresAt: null }
}

async function assetInfo(): Promise<{ downloadCount: number | null; publishedAt: string | null }> {
  return { downloadCount: null, publishedAt: null }
}

export function createGiteaConnector(hostUrl: string): GitHostConnector {
  const host = makeRestHost(giteaProfile(`${hostUrl}/api/v1`))

  return { ...host, beginConnect, waitForAuthorization, getTokenInfo, assetInfo }
}
