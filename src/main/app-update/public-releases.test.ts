// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, afterEach, vi } from 'vitest'
import { fetchPublishedReleases, fetchReleaseInstallers, releaseDownloadUrl } from './public-releases'

const APP_REPO = { owner: 'Bespok3d', repo: 'Bespok3d-desktop' }

function atomEntry(tag: string, title: string, notesHtml: string): string {
  return `<entry>
    <id>tag:github.com,2008:Repository/1/${tag}</id>
    <updated>2026-07-31T09:15:00Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/Bespok3d/Bespok3d-desktop/releases/tag/${tag}"/>
    <title>${title}</title>
    <content type="html">${notesHtml}</content>
  </entry>`
}

function atomFeed(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom"><title>Release notes</title>${entries.join('')}</feed>`
}

// Every read this module makes is a plain anonymous GET, so the fake answers by url and records what
// was asked for - the recorded urls are what prove no credentialed api call is being made.
function serveUrls(bodyByUrl: Record<string, string>): string[] {
  const requested: string[] = []
  vi.stubGlobal('fetch', function fakeFetch(url: string, init?: RequestInit) {
    requested.push(url)
    const body = bodyByUrl[url]
    const headerNames = Object.keys((init?.headers as Record<string, string>) ?? {})
    if (headerNames.length > 0) throw new Error(`sent headers it should not: ${headerNames.join(',')}`)

    return Promise.resolve({ ok: body !== undefined, status: body === undefined ? 404 : 200, text: () => Promise.resolve(body ?? '') })
  })

  return requested
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPublishedReleases', () => {
  const FEED_URL = 'https://github.com/Bespok3d/Bespok3d-desktop/releases.atom'

  it('reads the public release feed, with no account and no api', async () => {
    const requested = serveUrls({ [FEED_URL]: atomFeed([atomEntry('v0.1.0-alpha.34', '0.1.0-alpha.34', 'notes')]) })

    const releases = await fetchPublishedReleases(APP_REPO)

    expect(releases).toHaveLength(1)
    expect(requested).toEqual([FEED_URL])
    expect(requested[0]).not.toContain('api.github.com')
  })

  // The title is free text and here it drops the tag's leading v; a rollback asking github for
  // "0.1.0-alpha.34" would download nothing.
  it('takes the version from the release link, not from the title', async () => {
    serveUrls({ [FEED_URL]: atomFeed([atomEntry('v0.1.0-alpha.34', '0.1.0-alpha.34', 'notes')]) })

    const releases = await fetchPublishedReleases(APP_REPO)

    expect(releases[0].tag).toBe('v0.1.0-alpha.34')
    expect(releases[0].name).toBe('0.1.0-alpha.34')
    expect(releases[0].url).toBe('https://github.com/Bespok3d/Bespok3d-desktop/releases/tag/v0.1.0-alpha.34')
  })

  it('calls a version with a prerelease suffix a prerelease, and a plain one stable', async () => {
    serveUrls({
      [FEED_URL]: atomFeed([atomEntry('v0.2.0-beta.1', 'beta', 'notes'), atomEntry('v0.1.0', 'stable', 'notes')]),
    })

    const releases = await fetchPublishedReleases(APP_REPO)

    expect(releases.map((release) => release.prerelease)).toEqual([true, false])
  })

  it('turns the feed\'s html notes into the markdown the pane renders', async () => {
    serveUrls({ [FEED_URL]: atomFeed([atomEntry('v0.1.0', '0.1.0', '&lt;ul&gt;&lt;li&gt;update signed out&lt;/li&gt;&lt;/ul&gt;')]) })

    const releases = await fetchPublishedReleases(APP_REPO)

    expect(releases[0].body).toBe('- update signed out')
    expect(releases[0].publishedAt).toBe('2026-07-31T09:15:00Z')
  })

  it('is an empty list when nothing has been released yet', async () => {
    serveUrls({ [FEED_URL]: atomFeed([]) })

    await expect(fetchPublishedReleases(APP_REPO)).resolves.toEqual([])
  })

  it('says github is unreachable rather than reporting no releases', async () => {
    serveUrls({})

    await expect(fetchPublishedReleases(APP_REPO)).rejects.toThrow('github.com')
  })
})

describe('fetchReleaseInstallers', () => {
  const MAC_UPDATE_FILE = releaseDownloadUrl(APP_REPO, 'v0.1.0', 'latest-mac.yml')
  const MAC_UPDATE_YML = [
    'version: 0.1.0',
    'files:',
    '  - url: Bespok3d-0.1.0-arm64.dmg',
    '    sha512: irrelevant',
    '  - url: Bespok3d-0.1.0.dmg',
    'path: Bespok3d-0.1.0-arm64.dmg',
  ].join('\n')

  it('names an older version\'s installers from that release\'s own update file', async () => {
    const requested = serveUrls({ [MAC_UPDATE_FILE]: MAC_UPDATE_YML })

    const installers = await fetchReleaseInstallers(APP_REPO, 'v0.1.0', 'darwin', 'arm64')

    expect(installers.map((installer) => installer.name)).toEqual(['Bespok3d-0.1.0-arm64.dmg', 'Bespok3d-0.1.0.dmg'])
    expect(installers[0].downloadUrl).toBe(releaseDownloadUrl(APP_REPO, 'v0.1.0', 'Bespok3d-0.1.0-arm64.dmg'))
    expect(requested).toEqual([MAC_UPDATE_FILE])
  })

  it('asks for the arm64 update file on an arm linux machine', async () => {
    const requested = serveUrls({})

    await fetchReleaseInstallers(APP_REPO, 'v0.1.0', 'linux', 'arm64')

    expect(requested).toEqual([releaseDownloadUrl(APP_REPO, 'v0.1.0', 'latest-linux-arm64.yml')])
  })

  // A release older than this platform's build has nothing to install; the caller opens the release
  // page instead, so an unreadable update file is an empty list and never an error.
  it('offers nothing when that release published no installer for this machine', async () => {
    serveUrls({})

    await expect(fetchReleaseInstallers(APP_REPO, 'v0.1.0', 'darwin', 'arm64')).resolves.toEqual([])
  })

  it('offers nothing on a platform the app does not build for', async () => {
    const requested = serveUrls({})

    await expect(fetchReleaseInstallers(APP_REPO, 'v0.1.0', 'freebsd', 'x64')).resolves.toEqual([])
    expect(requested).toEqual([])
  })
})
