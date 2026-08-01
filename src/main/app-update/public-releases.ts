// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What versions exist and where their installers are, read the way anyone with a browser reads them:
// the release feed at `<host>/<owner>/<repo>/releases.atom` and the plain download link beside it.
// Both are served from the CDN, carry no credentials and spend no request ration, which is why
// checking for an update, reading the notes and rolling back all work signed out. The API is not
// touched here on purpose: it rations an anonymous caller to a handful of calls an hour per address,
// shared with every other anonymous read the app makes.
//
// The feed publishes the ten most recent releases. That is the whole version history this pane can
// offer without the API, and it is the window a rollback after a bad update actually needs.
import type { AssetInfo, ReleaseInfo } from '../git-host/connector'
import { releaseNotesFromHtml } from './release-notes-html'
import { parseSemanticVersion } from './version'

export interface PublicRepo {
  owner: string
  repo: string
}

const PUBLIC_HOST = 'https://github.com'
const FETCH_TIMEOUT_MS = 15000

// electron-builder writes one update file per platform build and `release.sh` uploads all of them to
// every release, so an older release names its own installers without anyone asking the API.
const UPDATE_FILE_BY_PLATFORM: Record<string, string> = {
  darwin: 'latest-mac.yml',
  win32: 'latest.yml',
  linux: 'latest-linux.yml',
}

function updateFileName(platform: string, arch: string): string | null {
  if (platform === 'linux' && arch === 'arm64') return 'latest-linux-arm64.yml'

  return UPDATE_FILE_BY_PLATFORM[platform] ?? null
}

export function releaseDownloadUrl(repo: PublicRepo, tag: string, fileName: string): string {
  return `${PUBLIC_HOST}/${repo.owner}/${repo.repo}/releases/download/${tag}/${fileName}`
}

// The message names github.com rather than the failing url: a user reading it can act on "github.com
// is unreachable", and cannot act on a path.
async function fetchPublicText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`Could not read the release list from github.com (${response.status})`)

  return response.text()
}

const FEED_ENTRY = /<entry>([\s\S]*?)<\/entry>/g
const ENTRY_TAG = /<link[^>]+href="([^"]*\/releases\/tag\/([^"]+))"/
const ENTRY_TITLE = /<title[^>]*>([\s\S]*?)<\/title>/
const ENTRY_UPDATED = /<updated>([^<]+)<\/updated>/
const ENTRY_CONTENT = /<content[^>]*>([\s\S]*?)<\/content>/

// The feed states no draft/prerelease flag, so the version says it instead: a tag carrying a
// prerelease suffix IS a prerelease, which is the same thing the app's own version comparison reads.
function isPrereleaseTag(tag: string): boolean {
  return parseSemanticVersion(tag).prereleaseLabel !== null
}

// The tag comes from the entry's own link and never from its title: a release publishes under a title
// that is free text (this app's is the bare version, without the tag's leading `v`), and a rollback
// asking for the wrong string would download nothing.
function feedEntryToRelease(entry: string): ReleaseInfo | null {
  const link = ENTRY_TAG.exec(entry)
  if (!link) return null
  const tag = decodeURIComponent(link[2])
  const content = ENTRY_CONTENT.exec(entry)

  return {
    id: tag,
    tag,
    name: ENTRY_TITLE.exec(entry)?.[1]?.trim() ?? tag,
    body: content ? releaseNotesFromHtml(content[1]) : '',
    prerelease: isPrereleaseTag(tag),
    publishedAt: ENTRY_UPDATED.exec(entry)?.[1] ?? null,
    url: link[1],
    assets: [],
  }
}

// Assets stay empty here: the feed does not list them, and the one flow that needs a file name (a
// rollback to a chosen version) asks for that version's own update file instead of every version's.
export async function fetchPublishedReleases(repo: PublicRepo): Promise<ReleaseInfo[]> {
  const feed = await fetchPublicText(`${PUBLIC_HOST}/${repo.owner}/${repo.repo}/releases.atom`)
  const entries = Array.from(feed.matchAll(FEED_ENTRY), (match) => feedEntryToRelease(match[1]))

  return entries.filter((release): release is ReleaseInfo => release !== null)
}

const UPDATE_FILE_ENTRY = /^\s*-?\s*url:\s*(\S+)\s*$/gm

function installerAsset(repo: PublicRepo, tag: string, fileName: string): AssetInfo {
  return { id: fileName, name: fileName, downloadUrl: releaseDownloadUrl(repo, tag, fileName), downloadCount: 0 }
}

// The installers a given release published for this machine, named by that release's own update file.
// An empty list is ordinary: a release predating this platform's build, or one whose update file was
// never uploaded, simply has nothing to install and the caller offers the release page instead.
export async function fetchReleaseInstallers(repo: PublicRepo, tag: string, platform: string, arch: string): Promise<AssetInfo[]> {
  const updateFile = updateFileName(platform, arch)
  if (!updateFile) return []
  const published = await fetchPublicText(releaseDownloadUrl(repo, tag, updateFile)).catch(() => '')

  return Array.from(published.matchAll(UPDATE_FILE_ENTRY), (match) => installerAsset(repo, tag, decodeURIComponent(match[1])))
}

export async function downloadPublicAsset(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`Could not download the installer from github.com (${response.status})`)

  return Buffer.from(await response.arrayBuffer())
}
