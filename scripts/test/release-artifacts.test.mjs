// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// v0.7.5-beta went out without the Linux Flatpak, and nothing said so: the build ran, the upload ran,
// the landing page linked a file that was never there. Nothing anywhere held the list of what a cut
// is made of, so a platform could go missing in silence. This proves the list is complete, that a
// build missing a platform is refused by name, that a stale updater file is caught before it points
// every installed copy at a download that does not exist, and that a half-finished upload is caught
// on the release itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetName, releaseArtifacts, websiteDownloads } from '../release-manifest.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const VERIFIER = join(REPO_ROOT, 'scripts', 'verify-release.mjs')
const VERSION = '9.9.9-beta'

const FEED_CONTENTS = {
  'latest-mac.yml': [`Bespok3d-${VERSION}-arm64-mac.zip`, `Bespok3d-${VERSION}-mac.zip`],
  'latest.yml': [`Bespok3d-Setup-${VERSION}.exe`],
  'latest-linux.yml': [`Bespok3d-${VERSION}.AppImage`],
  'latest-linux-arm64.yml': [`Bespok3d-${VERSION}-arm64.AppImage`],
}

function feedText(version, references) {
  return [`version: ${version}`, 'files:', ...references.map(function (reference) {
    return `  - url: ${reference}\n    size: 4`
  }), `path: ${references[0]}`, ''].join('\n')
}

// A build directory shaped like a finished cut: every artifact present and non-empty, every updater
// file naming this version and only files this build produced.
function completeBuildDir(skipped = []) {
  const buildDir = mkdtempSync(join(tmpdir(), 'b3d-cut-'))

  releaseArtifacts(VERSION)
    .filter(function (artifact) {
      return !skipped.includes(artifact.built)
    })
    .forEach(function (artifact) {
      writeFileSync(join(buildDir, artifact.built), FEED_CONTENTS[artifact.built] ? feedText(VERSION, FEED_CONTENTS[artifact.built]) : artifact.built)
    })

  return buildDir
}

function verifyBuilt(buildDir) {
  const attempt = spawnSync('node', [VERIFIER, 'built', VERSION, buildDir], { encoding: 'utf8' })

  return { ...attempt, output: `${attempt.stdout}${attempt.stderr}` }
}

function verifyPublished(buildDir, releaseAssets) {
  const attempt = spawnSync('node', [VERIFIER, 'published', VERSION, buildDir], {
    encoding: 'utf8',
    input: JSON.stringify(releaseAssets),
  })

  return { ...attempt, output: `${attempt.stdout}${attempt.stderr}` }
}

// What a complete upload of that build dir looks like coming back from `gh release view --json assets`.
function uploadedAssets(buildDir, skipped = []) {
  return releaseArtifacts(VERSION)
    .filter(function (artifact) {
      return !skipped.includes(artifact.built)
    })
    .map(function (artifact) {
      return { name: assetName(artifact.built), size: statSync(join(buildDir, artifact.built)).size }
    })
}

test('the list of what a cut is made of names every platform we ship', () => {
  const built = releaseArtifacts(VERSION).map(function (artifact) {
    return artifact.built
  })

  assert.ok(built.includes(`Bespok3d-${VERSION}-arm64.dmg`), 'macOS Apple Silicon')
  assert.ok(built.includes(`Bespok3d-${VERSION}.dmg`), 'macOS Intel')
  assert.ok(built.includes(`Bespok3d-${VERSION}-arm64-mac.zip`), 'macOS Apple Silicon update')
  assert.ok(built.includes(`Bespok3d-${VERSION}-mac.zip`), 'macOS Intel update')
  assert.ok(built.includes(`Bespok3d Setup ${VERSION}.exe`), 'Windows')
  assert.ok(built.includes(`Bespok3d-${VERSION}.AppImage`), 'Linux AppImage x86_64')
  assert.ok(built.includes(`Bespok3d-${VERSION}-arm64.AppImage`), 'Linux AppImage arm64')
  assert.ok(built.includes(`Bespok3d-${VERSION}-x86_64.flatpak`), 'Linux Flatpak')
  assert.ok(['latest-mac.yml', 'latest.yml', 'latest-linux.yml', 'latest-linux-arm64.yml'].every(function (feed) {
    return built.includes(feed)
  }), 'the files the app reads to find an update')
})

test('a complete build passes', () => {
  const passed = verifyBuilt(completeBuildDir())

  assert.equal(passed.status, 0, passed.output)
  assert.match(passed.output, /Linux Flatpak/)
})

test('the Flatpak going missing stops the cut and is named (v0.7.5-beta)', () => {
  const missing = verifyBuilt(completeBuildDir([`Bespok3d-${VERSION}-x86_64.flatpak`]))

  assert.equal(missing.status, 1)
  assert.match(missing.output, new RegExp(`Bespok3d-${VERSION}-x86_64\\.flatpak was not built`))
})

test('every other platform going missing stops the cut too', () => {
  const eachPlatform = [`Bespok3d-${VERSION}-arm64.dmg`, `Bespok3d-${VERSION}.dmg`, `Bespok3d Setup ${VERSION}.exe`, `Bespok3d-${VERSION}.AppImage`, `Bespok3d-${VERSION}-arm64.AppImage`]

  eachPlatform.forEach(function (installer) {
    assert.equal(verifyBuilt(completeBuildDir([installer])).status, 1, `${installer} went missing and the cut carried on`)
  })
})

test('an installer that was written but is empty is not counted as built', () => {
  const buildDir = completeBuildDir()
  writeFileSync(join(buildDir, `Bespok3d-${VERSION}.AppImage`), '')

  assert.equal(verifyBuilt(buildDir).status, 1)
})

test('an update file left over from an earlier cut is caught', () => {
  const buildDir = completeBuildDir()
  writeFileSync(join(buildDir, 'latest-linux.yml'), feedText('0.0.1-beta', ['Bespok3d-0.0.1-beta.AppImage']))
  const stale = verifyBuilt(buildDir)

  assert.equal(stale.status, 1)
  assert.match(stale.output, /latest-linux\.yml says version 0\.0\.1-beta/)
})

test('an update file pointing at a download this build never made is caught', () => {
  const buildDir = completeBuildDir()
  writeFileSync(join(buildDir, 'latest.yml'), feedText(VERSION, ['Bespok3d-Setup-9.9.9-beta-x64.exe']))
  const wrong = verifyBuilt(buildDir)

  assert.equal(wrong.status, 1)
  assert.match(wrong.output, /which this build did not produce/)
})

test('a release carrying the whole build passes', () => {
  const buildDir = completeBuildDir()
  const passed = verifyPublished(buildDir, uploadedAssets(buildDir))

  assert.equal(passed.status, 0, passed.output)
})

test('a release missing a platform is caught after the upload, by name', () => {
  const buildDir = completeBuildDir()
  const incomplete = verifyPublished(buildDir, uploadedAssets(buildDir, [`Bespok3d-${VERSION}-x86_64.flatpak`]))

  assert.equal(incomplete.status, 1)
  assert.match(incomplete.output, new RegExp(`Bespok3d-${VERSION}-x86_64\\.flatpak is not on the release`))
})

test('an upload that died halfway is caught, not read as present', () => {
  const buildDir = completeBuildDir()
  const truncated = uploadedAssets(buildDir).map(function (asset) {
    return asset.name === `Bespok3d-${VERSION}.dmg` ? { ...asset, size: 12 } : asset
  })
  const half = verifyPublished(buildDir, truncated)

  assert.equal(half.status, 1)
  assert.match(half.output, /bytes on the release and/)
})

test('the landing page can only link downloads the cut produces', () => {
  const served = releaseArtifacts(VERSION).map(function (artifact) {
    return assetName(artifact.built)
  })

  websiteDownloads(VERSION).forEach(function (download) {
    assert.ok(served.includes(download.asset), `the page links ${download.asset}, which no cut produces`)
  })
})
