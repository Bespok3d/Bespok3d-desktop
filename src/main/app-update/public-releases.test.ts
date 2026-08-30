// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readPublishedReleases, fetchReleaseInstallers, releaseDownloadUrl } from './public-releases'

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

// The feed url is reachable but answers with a failure, the way github answers a repo it will not
// serve anonymously.
function serveStatus(status: number): void {
  vi.stubGlobal('fetch', function refusingFetch() {
    return Promise.resolve({ ok: false, status, text: () => Promise.resolve('') })
  })
}

// No network at all: fetch itself rejects, it never gets as far as a status.
function serveNoNetwork(): void {
  vi.stubGlobal('fetch', function offlineFetch() {
    return Promise.reject(new Error('ENOTFOUND github.com'))
  })
}

// The status says the feed is coming and then the connection dies mid body.
function serveTornBody(): void {
  vi.stubGlobal('fetch', function tearingFetch() {
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.reject(new Error('terminated')) })
  })
}

const FEED_URL = 'https://github.com/Bespok3d/Bespok3d-desktop/releases.atom'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readPublishedReleases', () => {
  it('reads the public release feed, with no account and no api', async () => {
    const requested = serveUrls({ [FEED_URL]: atomFeed([atomEntry('v0.1.0-alpha.34', '0.1.0-alpha.34', 'notes')]) })

    const { releases, problem } = await readPublishedReleases(APP_REPO)

    expect(releases).toHaveLength(1)
    expect(problem).toBeNull()
    expect(requested).toEqual([FEED_URL])
    expect(requested[0]).not.toContain('api.github.com')
  })

  // The title is free text and here it drops the tag's leading v; a rollback asking github for
  // "0.1.0-alpha.34" would download nothing.
  it('takes the version from the release link, not from the title', async () => {
    serveUrls({ [FEED_URL]: atomFeed([atomEntry('v0.1.0-alpha.34', '0.1.0-alpha.34', 'notes')]) })

    const { releases } = await readPublishedReleases(APP_REPO)

    expect(releases[0].tag).toBe('v0.1.0-alpha.34')
    expect(releases[0].name).toBe('0.1.0-alpha.34')
    expect(releases[0].url).toBe('https://github.com/Bespok3d/Bespok3d-desktop/releases/tag/v0.1.0-alpha.34')
  })

  // Nothing reads the label itself: alpha, beta or any other suffix is a prerelease, and a plain
  // version is stable. Renaming the tag series must never change what the app finds.
  it('calls any prerelease suffix a prerelease, and a plain version stable', async () => {
    serveUrls({
      [FEED_URL]: atomFeed([atomEntry('v0.7.0-beta', 'beta', ''), atomEntry('v0.2.0-alpha.1', 'alpha', ''), atomEntry('v0.1.0', 'stable', '')]),
    })

    const { releases } = await readPublishedReleases(APP_REPO)

    expect(releases.map((release) => release.prerelease)).toEqual([true, true, false])
  })

  it('turns the feed\'s html notes into the markdown the pane renders', async () => {
    serveUrls({ [FEED_URL]: atomFeed([atomEntry('v0.1.0', '0.1.0', '&lt;ul&gt;&lt;li&gt;update signed out&lt;/li&gt;&lt;/ul&gt;')]) })

    const { releases } = await readPublishedReleases(APP_REPO)

    expect(releases[0].body).toBe('- update signed out')
    expect(releases[0].publishedAt).toBe('2026-07-31T09:15:00Z')
  })
})

// A read that fails must say WHY, because the three causes read differently to the user: nothing is
// published, the machine is offline, or github is having a bad day.
describe('readPublishedReleases when the feed cannot be read', () => {
  it('reports an empty feed as no problem at all', async () => {
    serveUrls({ [FEED_URL]: atomFeed([]) })

    await expect(readPublishedReleases(APP_REPO)).resolves.toEqual({ releases: [], problem: null })
  })

  it('reports a feed github will not serve as nothing published', async () => {
    serveStatus(404)

    await expect(readPublishedReleases(APP_REPO)).resolves.toEqual({ releases: [], problem: 'notPublished' })
  })

  it('reports an unreachable github as unreachable, never as no releases', async () => {
    serveNoNetwork()

    await expect(readPublishedReleases(APP_REPO)).resolves.toEqual({ releases: [], problem: 'unreachable' })
  })

  it('reports a github that answers badly as unavailable', async () => {
    serveStatus(503)

    await expect(readPublishedReleases(APP_REPO)).resolves.toEqual({ releases: [], problem: 'unavailable' })
  })

  it('reports a feed that stops arriving halfway as unavailable, and never rejects', async () => {
    serveTornBody()

    await expect(readPublishedReleases(APP_REPO)).resolves.toEqual({ releases: [], problem: 'unavailable' })
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

// Everything about a release comes from an answer served over the network: which versions exist, where
// each one's page is, and what each one's installer is called. The page address ends up at the machine
// to be opened, and the installer name ends up as a path the machine is asked to run, so an answer that
// has been tampered with picks both unless this module refuses first.
describe('an update answer that says something it should not', () => {
  function feedWithLink(href: string): Record<string, string> {
    return { [FEED_URL]: atomFeed([`<entry><link href="${href}"/><title>0.1.0</title></entry>`]) }
  }

  it('does not list a version whose page is not a web address', async () => {
    serveUrls(feedWithLink('file:///Applications/Anything.app/releases/tag/v0.1.0'))

    await expect(readPublishedReleases(APP_REPO)).resolves.toEqual({ releases: [], problem: null })
  })

  it('lists the version when its page is an ordinary release page', async () => {
    serveUrls(feedWithLink('https://github.com/Bespok3d/Bespok3d-desktop/releases/tag/v0.1.0'))
    const published = await readPublishedReleases(APP_REPO)

    expect(published.releases.map((release) => release.tag)).toEqual(['v0.1.0'])
  })

  it('offers no installer whose name is a path of its own', async () => {
    const updateFile = releaseDownloadUrl(APP_REPO, 'v0.1.0', 'latest-mac.yml')
    serveUrls({ [updateFile]: ['files:', '  - url: ../../../../Library/LaunchAgents/evil.plist', '  - url: Bespok3d-0.1.0.dmg'].join('\n') })
    const installers = await fetchReleaseInstallers(APP_REPO, 'v0.1.0', 'darwin', 'arm64')

    expect(installers.map((installer) => installer.name)).toEqual(['Bespok3d-0.1.0.dmg'])
  })

  it('offers no installer whose name cannot even be read', async () => {
    const updateFile = releaseDownloadUrl(APP_REPO, 'v0.1.0', 'latest-mac.yml')
    serveUrls({ [updateFile]: 'files:\n  - url: Bespok3d-100%.dmg\n' })

    await expect(fetchReleaseInstallers(APP_REPO, 'v0.1.0', 'darwin', 'arm64')).resolves.toEqual([])
  })
})
