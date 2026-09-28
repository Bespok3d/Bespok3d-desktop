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
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetName, releaseArtifacts, releaseInstallers, updaterFeeds, websiteDownloads } from '../release-manifest.mjs'
import electronBuilderConfigForEnvironment, { electronBuilderConfig } from '../electron-builder.config.mjs'
import { liveVersion, versionForChannel, versionLabelError } from '../channels.mjs'

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

function verifyBuilt(buildDir, channelName = 'live', version = VERSION) {
  const attempt = spawnSync('node', [VERIFIER, 'built', version, buildDir, channelName], { encoding: 'utf8' })

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

test('each channel config has its own identity and exactly one protocol scheme', () => {
  const channelExpectations = [
    ['development', 'io.bespok3d.app.dev', 'Bespok3d Dev', 'b3d-dev', 'prerelease'],
    ['staging', 'io.bespok3d.app.staging', 'Bespok3d Staging', 'b3d-staging', 'prerelease'],
    ['live', 'io.bespok3d.app', 'Bespok3d', 'b3d', 'release'],
  ]

  channelExpectations.forEach(function ([channelName, appId, productName, scheme, releaseType]) {
    const config = electronBuilderConfig(channelName)

    assert.equal(config.appId, appId)
    assert.equal(config.productName, productName)
    if (channelName === 'development') {
      assert.deepEqual(config.publish, [])
    } else {
      assert.equal(config.publish[0].releaseType, releaseType)
      assert.equal(config.publish[0].channel, channelName === 'live' ? 'latest' : 'bespok3d-staging')
    }
    assert.deepEqual(config.protocols.map(protocol => protocol.schemes).flat(), [scheme])
    assert.deepEqual(config.mac.extendInfo.CFBundleURLTypes.map(protocol => protocol.CFBundleURLSchemes).flat(), [scheme])
  })
})

test('Staging versions derive once from the complete Live version', () => {
  assert.equal(versionForChannel('staging', '0.7.7-beta'), '0.7.7-beta-staging')
  assert.equal(liveVersion('0.7.7-beta-staging'), '0.7.7-beta')
  assert.equal(versionForChannel('staging', '0.7.7-beta-staging'), '0.7.7-beta-staging')
  assert.equal(versionLabelError('staging', '0.7.7-beta-staging'), null)
  assert.equal(versionLabelError('staging', '0.7.7-staging'), null)
})

test('published versions must carry the target label while local channel builds remain version-flexible', () => {
  assert.equal(versionLabelError('live', '0.7.6-beta'), null)
  assert.equal(versionLabelError('live', '0.7.7'), null)
  assert.equal(versionLabelError('staging', '0.7.7-beta-staging'), null)
  assert.match(versionLabelError('staging', '0.7.6-beta'), /requires version label beta-staging or staging/)
  assert.equal(versionLabelError('development', '0.1.0-anything'), null)
})

test('the generated builder config rejects a mismatched published cut', () => {
  const previousFlavor = process.env.B3D_CHANNEL
  const previousCutFlag = process.env.B3D_PUBLISHED_CUT
  const previousBuildVersion = process.env.B3D_VERSION
  process.env.B3D_CHANNEL = 'staging'
  process.env.B3D_PUBLISHED_CUT = 'true'
  process.env.B3D_VERSION = '0.7.6-beta'

  try {
    assert.throws(() => electronBuilderConfigForEnvironment(), /requires version label beta-staging or staging/)
  } finally {
    if (previousFlavor === undefined) delete process.env.B3D_CHANNEL
    else process.env.B3D_CHANNEL = previousFlavor
    if (previousCutFlag === undefined) delete process.env.B3D_PUBLISHED_CUT
    else process.env.B3D_PUBLISHED_CUT = previousCutFlag
    if (previousBuildVersion === undefined) delete process.env.B3D_VERSION
    else process.env.B3D_VERSION = previousBuildVersion
  }
})

test('channel artifact names do not collide', () => {
  const artifactNames = ['live', 'staging', 'development'].map(function (channelName) {
    return releaseInstallers('0.7.7-pre', channelName).map(installer => installer.built)
  })

  assert.equal(new Set(artifactNames.flat()).size, artifactNames.flat().length)
  assert.ok(artifactNames[0].includes('Bespok3d-0.7.7-pre-arm64.dmg'))
  assert.ok(artifactNames[1].includes('Bespok3d Staging-0.7.7-pre-arm64.dmg'))
  assert.ok(artifactNames[2].includes('Bespok3d Dev-0.7.7-pre-arm64.dmg'))
  assert.deepEqual(updaterFeeds('live'), ['latest-mac.yml', 'latest.yml', 'latest-linux.yml', 'latest-linux-arm64.yml'])
  assert.deepEqual(updaterFeeds('staging'), ['bespok3d-staging-mac.yml', 'bespok3d-staging.yml', 'bespok3d-staging-linux.yml', 'bespok3d-staging-linux-arm64.yml'])
  assert.deepEqual(updaterFeeds('development'), ['bespok3d-dev-mac.yml', 'bespok3d-dev.yml', 'bespok3d-dev-linux.yml', 'bespok3d-dev-linux-arm64.yml'])
})

test('the release verifier reads the selected channel artifact and feed names', () => {
  const stagingVersion = '0.7.7-beta-staging'
  const stagingBuildDir = mkdtempSync(join(tmpdir(), 'b3d-staging-cut-'))
  const stagingInstaller = assetName(releaseInstallers(stagingVersion, 'staging')[0].built)

  releaseArtifacts(stagingVersion, 'staging').forEach(function (artifact) {
    const contents = updaterFeeds('staging').includes(artifact.built)
      ? feedText(stagingVersion, [stagingInstaller])
      : artifact.built

    writeFileSync(join(stagingBuildDir, artifact.built), contents)
  })

  const stagingPass = verifyBuilt(stagingBuildDir, 'staging', stagingVersion)
  const liveMismatch = verifyBuilt(stagingBuildDir, 'live', stagingVersion)

  assert.equal(stagingPass.status, 0, stagingPass.output)
  assert.equal(liveMismatch.status, 1)
  assert.match(liveMismatch.output, /Bespok3d-0\.7\.7-beta-staging-arm64\.dmg was not built/)
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

// The 0.7.6-beta cut then lost the Flatpak a second way: the Linux runtimes the build sits on live
// inside the builder image, and refreshing one from Flathub cannot write there, so the Flatpak stage
// died the first time Flathub shipped a runtime release. Keeping them on their own volume is what
// makes the stage survive that, and dropping the mount would lose the download again in silence.
test('the Flatpak build keeps its Linux runtimes somewhere a refresh can write', () => {
  const script = readFileSync(join(REPO_ROOT, 'scripts', 'flatpak-build.sh'), 'utf8')

  assert.match(script, /-v "\$RUNTIME_VOLUME":\/var\/lib\/flatpak/)
})

// It lost it a third way waiting to happen: the build refreshed those runtimes from Flathub every
// time, so a cut needed Flathub reachable and took whatever it was serving that day. The Flatpak is
// built against the pinned runtimes only, which is what makes two cuts of the same source match.
test('the Flatpak build takes its runtimes from the pin, not from Flathub that day', () => {
  const script = readFileSync(join(REPO_ROOT, 'scripts', 'flatpak-build.sh'), 'utf8')

  assert.match(script, /flatpak remote-modify --disable flathub/)
})

// Nothing fetches a runtime at build time any more, so a pin the builder image does not carry is no
// longer quietly downloaded: it fails the cut. The two places that name the runtime version have to
// say the same thing, and this is what says so before a release finds out.
test('the runtime the app pins is the runtime the builder image carries', () => {
  const pinned = electronBuilderConfig('live').flatpak
  const dockerfile = readFileSync(join(REPO_ROOT, 'scripts', 'flatpak', 'Dockerfile'), 'utf8')

  assert.ok(dockerfile.includes(`org.freedesktop.Platform//${pinned.runtimeVersion}`), `the image installs no org.freedesktop.Platform//${pinned.runtimeVersion}`)
  assert.ok(dockerfile.includes(`org.freedesktop.Sdk//${pinned.runtimeVersion}`), `the image installs no org.freedesktop.Sdk//${pinned.runtimeVersion}`)
  assert.ok(dockerfile.includes(`org.electronjs.Electron2.BaseApp//${pinned.baseVersion}`), `the image installs no org.electronjs.Electron2.BaseApp//${pinned.baseVersion}`)
})
