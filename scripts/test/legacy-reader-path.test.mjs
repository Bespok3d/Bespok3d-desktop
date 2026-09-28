// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/v0.7.6-beta')
const requireFixture = createRequire(import.meta.url)
const semver = requireFixture('semver')
const providerPackage = JSON.parse(readFileSync(join(fixtureDirectory, 'electron-updater-lock.json'), 'utf8'))
const stagingTag = 'v0.7.8-beta-staging'

function releaseEntry(tag) {
  return `<entry><title>${tag.slice(1)}</title><link href="https://github.com/Bespok3d/Bespok3d-desktop/releases/tag/${tag}"/><updated>2026-09-27T00:00:00Z</updated><content>notes</content></entry>`
}

function loadLockedProvider() {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'b3d-legacy-provider-'))
  const providerDirectory = join(temporaryRoot, 'build/providers')
  mkdirSync(providerDirectory, { recursive: true })
  symlinkSync(join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), 'node_modules'), join(temporaryRoot, 'node_modules'), 'dir')
  writeFileSync(join(temporaryRoot, 'build/util.js'), readFileSync(join(fixtureDirectory, 'electron-updater-6.8.3/build/util.fixture')))
  writeFileSync(join(providerDirectory, 'Provider.js'), readFileSync(join(fixtureDirectory, 'electron-updater-6.8.3/build/providers/Provider.fixture')))
  writeFileSync(join(providerDirectory, 'GitHubProvider.js'), readFileSync(join(fixtureDirectory, 'electron-updater-6.8.3/build/providers/GitHubProvider.fixture')))

  return { temporaryRoot, GitHubProvider: requireFixture(join(providerDirectory, 'GitHubProvider.js')).GitHubProvider }
}

function lockedProviderUpdate(GitHubProvider, feed, requestedUrls) {
  const provider = new GitHubProvider(
    { owner: 'Bespok3d', repo: 'Bespok3d-desktop' },
    { channel: 'beta', allowPrerelease: true, currentVersion: '0.7.6-beta', fullChangelog: false },
    { executor: { request: async (options) => {
      const requestedUrl = `https://${options.hostname}${options.path}`
      requestedUrls.push(requestedUrl)
       if (requestedUrl.endsWith('.atom')) return feed
       const version = requestedUrl.includes('/v0.7.6-beta/') ? '0.7.6-beta' : '0.7.7-beta'
       return `version: ${version}\nfiles:\n  - url: Bespok3d-Setup-${version}.exe\n    sha512: fixture\n    size: 1\npath: Bespok3d-Setup-${version}.exe\nsha512: fixture\nreleaseDate: 2026-09-27T00:00:00Z\n`
    } }, platform: 'win32' },
  )

  return provider.getLatestVersion()
}

test('shipped v0.7.6-beta automatic reader replays its locked provider against a Live-only host', async () => {
  const updaterSource = readFileSync(join(fixtureDirectory, 'app-update/index.tagged-source'), 'utf8')
  const feedSource = readFileSync(join(fixtureDirectory, 'app-update/feed.tagged-source'), 'utf8')
  const providerVersion = providerPackage['node_modules/electron-updater'].version
  assert.equal(providerVersion, '6.8.3')
  assert.match(updaterSource, /autoUpdater\.allowPrerelease = true/)
  assert.match(updaterSource, /autoUpdater\.setFeedURL\(feed\)/)
  assert.match(feedSource, /provider: 'github'/)

  const surface = JSON.parse(readFileSync(join(fixtureDirectory, 'release-surface.json'), 'utf8'))
  assert.ok(surface.liveTags.every((tag) => !tag.endsWith('-staging')))
  assert.ok(surface.stagingTags.includes(stagingTag))
  const feed = `<feed>${surface.liveTags.map(releaseEntry).join('')}</feed>`
  const requestedUrls = []
  const { temporaryRoot, GitHubProvider } = loadLockedProvider()
  try {
    const update = await lockedProviderUpdate(GitHubProvider, feed, requestedUrls)
    assert.equal(update.tag, 'v0.7.7-beta')
    assert.ok(requestedUrls.includes('https://github.com/Bespok3d/Bespok3d-desktop/releases.atom'))
    assert.ok(requestedUrls.includes('https://github.com/Bespok3d/Bespok3d-desktop/releases/download/v0.7.7-beta/beta.yml'))
    assert.ok(!requestedUrls.some((url) => url.includes(stagingTag)))
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test('shipped Live provider skips a newer Staging prerelease in its own GitHub release feed', async () => {
  const shippedReader = readFileSync(join(fixtureDirectory, 'app-update/index.tagged-source'), 'utf8')
  const shippedView = readFileSync(join(fixtureDirectory, 'app-update/view.tagged-source'), 'utf8')
  assert.match(shippedReader, /autoUpdater\.allowPrerelease = true/)
  assert.match(shippedView, /platform === 'darwin' \|\| platform === 'win32' \|\| platform === 'linux' \? 'autoInstall'/)
  const feed = `<feed>${[stagingTag, 'v0.7.6-beta'].map(releaseEntry).join('')}</feed>`
  const requestedUrls = []
  const { temporaryRoot, GitHubProvider } = loadLockedProvider()
  try {
    const update = await lockedProviderUpdate(GitHubProvider, feed, requestedUrls)
    assert.equal(update.tag, 'v0.7.6-beta')
    assert.equal(semver.gt(update.version, '0.7.6-beta'), false)
    assert.ok(requestedUrls.includes('https://github.com/Bespok3d/Bespok3d-desktop/releases.atom'))
    assert.ok(requestedUrls.includes('https://github.com/Bespok3d/Bespok3d-desktop/releases/download/v0.7.6-beta/beta.yml'))
    assert.ok(!requestedUrls.some((url) => url.includes(stagingTag)))
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test('shipped Live provider skips Staging in a real public GitHub Atom feed', {
  skip: !process.env.B3D_STAGING_PROOF_ATOM_URL,
}, async () => {
  const response = await fetch(process.env.B3D_STAGING_PROOF_ATOM_URL)
  assert.equal(response.status, 200)
  const feed = await response.text()
  assert.ok(feed.indexOf(stagingTag) < feed.indexOf('v0.7.6-beta'))
  const requestedUrls = []
  const { temporaryRoot, GitHubProvider } = loadLockedProvider()
  try {
    const update = await lockedProviderUpdate(GitHubProvider, feed, requestedUrls)
    assert.equal(update.tag, 'v0.7.6-beta')
    assert.equal(semver.gt(update.version, '0.7.6-beta'), false)
    assert.ok(!requestedUrls.some((url) => url.includes(stagingTag)))
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})
