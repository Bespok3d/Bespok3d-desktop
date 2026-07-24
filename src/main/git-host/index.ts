import { writeFileSync } from 'fs'
import { readJsonFile } from '../json-store'
import { userDataPath } from '../app-paths'
import { createGitHubConnector } from './github'
import { createGiteaConnector } from './gitea'
import type { GitHostConnector } from './connector'

var cachedConnector: GitHostConnector | null = null

export interface GitHostSettings {
  type: 'github' | 'gitea'
  githubClientId?: string
  giteaUrl?: string
  pluginRepos?: { owner: string; repo: string }[]
  listRepos?: { owner: string; repo: string }[]
}

// The Bespok3d GitHub OAuth App client id (PUBLIC and baked into the binary by design, ADR-0015;
// device flow uses no client secret, so there is nothing secret here). Registered under the Bespok3d
// org with Device Flow enabled. The moment it is set, GitHub becomes the default host; while empty
// the default stays Gitea so the Git Host pane never breaks.
const GITHUB_CLIENT_ID: string = 'Ov23li5LXD9QROfarmj4'

// The official published list, used as the default catalog source so testers get it out of the box.
const OFFICIAL_LIST: { owner: string; repo: string }[] = [{ owner: 'Bespok3d', repo: 'main-index' }]

const DEFAULTS: GitHostSettings = GITHUB_CLIENT_ID
  ? { type: 'github', githubClientId: GITHUB_CLIENT_ID, giteaUrl: 'https://git.unlucio.com', listRepos: OFFICIAL_LIST }
  : { type: 'gitea', giteaUrl: 'https://git.unlucio.com' }

function settingsPath(): string {
  return userDataPath('git-host.json')
}

type LegacySettings = GitHostSettings & {
  pluginRepo?: { owner: string; repo: string }
  listRepo?: { owner: string; repo: string }
}

export function readSettings(): GitHostSettings {
  const raw = readJsonFile<Partial<LegacySettings>>(settingsPath(), {})
  // The host and client id are decided by the build (the baked GITHUB_CLIENT_ID), not by a persisted
  // choice: there is no host-picker UI yet, so a stale git-host.json must not pin the old Gitea
  // default. Repos and other fields still merge from the saved file.
  const merged: GitHostSettings = { ...DEFAULTS, ...raw, type: DEFAULTS.type, githubClientId: DEFAULTS.githubClientId }
  if (raw.pluginRepo && !raw.pluginRepos) merged.pluginRepos = [raw.pluginRepo]
  if (raw.listRepo && !raw.listRepos) merged.listRepos = [raw.listRepo]
  delete (merged as LegacySettings).pluginRepo
  delete (merged as LegacySettings).listRepo

  return merged
}

export function writeSettings(settings: GitHostSettings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  cachedConnector = null
}

export function activeConnector(): GitHostConnector {
  if (cachedConnector) return cachedConnector
  const settings = readSettings()
  if (settings.type === 'github') {
    if (!settings.githubClientId) throw new Error('githubClientId is required for GitHub connector')
    cachedConnector = createGitHubConnector(settings.githubClientId)

    return cachedConnector
  }
  if (!settings.giteaUrl) throw new Error('giteaUrl is required for Gitea connector')
  cachedConnector = createGiteaConnector(settings.giteaUrl)

  return cachedConnector
}
