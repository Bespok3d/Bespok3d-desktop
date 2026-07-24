import { load } from '../keychain'
import { makeRestHost, type RestHostProfile, type JsonObject } from '../rest-host'
import { makeGitHubDeviceFlow, GITHUB_KEYCHAIN_KEY } from './device-flow'
import type { GitHostConnector, TokenInfo, AssetInfo, AssetStat } from '../connector'

const API_BASE = 'https://api.github.com'
// Static headers GitHub wants on every JSON request (alongside the Bearer auth).
const GITHUB_JSON_HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }

// downloadUrl is the asset's API url (raw.url, .../releases/assets/{id}), NOT browser_download_url:
// on a PRIVATE repo the browser url 404s for a token request, while the API url + Accept:octet-stream
// redirects to a signed download. The same API url also backs assetInfo's JSON GET and the publisher
// regex (/repos/{owner}/). browser_download_url only works for public repos.
function mapAsset(raw: JsonObject): AssetInfo {
  return { id: String(raw.id), name: String(raw.name), downloadUrl: String(raw.url), downloadCount: Number(raw.download_count) }
}

const githubProfile: RestHostProfile = {
  label: 'GitHub',
  keychainKey: GITHUB_KEYCHAIN_KEY,
  apiBase: API_BASE,
  requestHeaders: (token, withBody) => ({ Authorization: `Bearer ${token}`, ...GITHUB_JSON_HEADERS, ...(withBody ? { 'Content-Type': 'application/json' } : {}) }),
  mapAsset,
  accountName: (raw) => String(raw.name ?? raw.login),
  // Include org repos the user can use, not just their own, so org-owned lists/plugins are
  // selectable. Sorted by full name (owner/repo) so org repos group together.
  listReposQuery: '?per_page=100&affiliation=owner,collaborator,organization_member&sort=full_name',
  listOrgsPath: '/user/orgs',
  orgName: (raw) => String(raw.login),
  newRepoBody: (name, description, isPrivate) => ({ name, description, private: isPrivate }),
  contentCreateMethod: 'PUT',
  listReleasesQuery: '?per_page=100',
  uploadAssetUrl: (repo, releaseId, encodedName) =>
    `https://uploads.github.com/repos/${repo.owner}/${repo.repo}/releases/${releaseId}/assets?name=${encodedName}`,
  uploadAssetHeaders: (token) => ({ Authorization: `Bearer ${token}`, ...GITHUB_JSON_HEADERS, 'Content-Type': 'application/octet-stream' }),
  downloadAssetHeaders: (token) => ({ Authorization: `Bearer ${token}`, Accept: 'application/octet-stream', 'X-GitHub-Api-Version': '2022-11-28' }),
}

function requireGitHubToken(): string {
  const token = load(GITHUB_KEYCHAIN_KEY)
  if (!token) throw new Error('Not connected to GitHub')

  return token
}

async function getTokenInfo(): Promise<TokenInfo> {
  const response = await fetch(`${API_BASE}/user`, {
    headers: { Authorization: `Bearer ${requireGitHubToken()}`, ...GITHUB_JSON_HEADERS },
  })
  if (!response.ok) throw new Error(`GitHub /user: ${response.status}`)
  const scopes = (response.headers.get('X-OAuth-Scopes') ?? '').split(',').map((scope) => scope.trim()).filter(Boolean)

  return { type: 'device-flow', scopes, expiresAt: null }
}

// Real stats for a release asset, by its API url (the same url plugins use as download_url): the
// download count GitHub records and the asset's upload time (the actual publish date of that
// version). JSON view of the asset, not the octet-stream download. Empty fields when unknown.
async function assetInfo(url: string): Promise<AssetStat> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${requireGitHubToken()}`, ...GITHUB_JSON_HEADERS } })
  if (!response.ok) return { downloadCount: null, publishedAt: null }
  const asset = (await response.json()) as { download_count?: number; created_at?: string }

  return {
    downloadCount: typeof asset.download_count === 'number' ? asset.download_count : null,
    publishedAt: typeof asset.created_at === 'string' ? asset.created_at.slice(0, 10) : null,
  }
}

export function createGitHubConnector(clientId: string): GitHostConnector {
  const host = makeRestHost(githubProfile)
  const deviceFlow = makeGitHubDeviceFlow(clientId)

  return {
    ...host,
    beginConnect: deviceFlow.beginConnect,
    waitForAuthorization: deviceFlow.waitForAuthorization,
    getTokenInfo,
    assetInfo,
  }
}
