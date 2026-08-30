// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Refuse to call a cut finished while a platform is missing. Two things are checked, both against
// the one list in release-manifest.mjs:
//
//   built     <version> <build-dir>   every installer, blockmap and updater feed is in dist/release,
//                                     is not empty, and no feed is left over from an earlier cut
//   published <version> <build-dir>   every one of them is on the GitHub release at the size it was
//                                     built at. The release's asset list is read from stdin, as
//                                     `gh release view <tag> --json assets -q .assets` prints it
//
// release.sh runs both. Run it by hand to check a release someone else cut.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { UPDATER_FEEDS, assetName, releaseArtifacts } from './release-manifest.mjs'

function builtSize(buildDir, builtName) {
  const path = join(buildDir, builtName)

  return existsSync(path) ? statSync(path).size : null
}

function missingFromBuild(version, buildDir) {
  return releaseArtifacts(version)
    .filter(function (artifact) {
      return !builtSize(buildDir, artifact.built)
    })
    .map(function (artifact) {
      return `${artifact.built} was not built (nothing usable at ${join(buildDir, artifact.built)})`
    })
}

function declaredVersion(feedText) {
  const declared = feedText.match(/^version:\s*(\S+)/m)

  return declared ? declared[1] : null
}

// The files a feed tells electron-updater to download, named the way the release serves them.
function feedReferences(feedText) {
  return [...feedText.matchAll(/^\s*(?:- url|path):\s*(\S.*)$/gm)].map(function (reference) {
    return reference[1].trim()
  })
}

// A feed carries no version in its name, so an old one sits in the build directory looking exactly
// like a new one and sends every installed copy after a download that was never uploaded.
function feedComplaints(version, buildDir, feed, servedNames) {
  const path = join(buildDir, feed)

  if (!existsSync(path)) {
    return [`${feed} is missing; the app has nothing to read when it looks for that platform's update`]
  }

  const feedText = readFileSync(path, 'utf8')
  const declared = declaredVersion(feedText)
  const strays = feedReferences(feedText).filter(function (reference) {
    return !servedNames.has(reference)
  })

  return [
    ...(declared === version ? [] : [`${feed} says version ${declared}, not ${version}; it is left over from an earlier build`]),
    ...strays.map(function (stray) {
      return `${feed} points the app at ${stray}, which this build did not produce`
    }),
  ]
}

function servedAssetNames(version) {
  return new Set(releaseArtifacts(version).map(function (artifact) {
    return assetName(artifact.built)
  }))
}

function buildComplaints(version, buildDir) {
  const servedNames = servedAssetNames(version)

  return [
    ...missingFromBuild(version, buildDir),
    ...UPDATER_FEEDS.flatMap(function (feed) {
      return feedComplaints(version, buildDir, feed, servedNames)
    }),
  ]
}

function uploadComplaint(artifact, buildDir, uploadedSizes) {
  const served = assetName(artifact.built)
  const uploaded = uploadedSizes.get(served)
  const local = builtSize(buildDir, artifact.built)

  if (uploaded === undefined) {
    return [`${served} is not on the release`]
  }

  if (local && uploaded !== local) {
    return [`${served} is ${uploaded} bytes on the release and ${local} bytes here; the upload did not finish, or it is from another build`]
  }

  return []
}

function publishComplaints(version, buildDir, releaseAssets) {
  const uploadedSizes = new Map(releaseAssets.map(function (asset) {
    return [asset.name, asset.size]
  }))

  return releaseArtifacts(version).flatMap(function (artifact) {
    return uploadComplaint(artifact, buildDir, uploadedSizes)
  })
}

function report(complaints, whatIsWrong, whatIsRight) {
  if (complaints.length === 0) {
    console.log(whatIsRight)

    return
  }

  console.error(whatIsWrong)
  complaints.forEach(function (complaint) {
    console.error(`  - ${complaint}`)
  })
  process.exit(1)
}

function checkBuild(version, buildDir) {
  const expected = releaseArtifacts(version).length

  report(
    buildComplaints(version, buildDir),
    `Error: the build of ${version} in ${buildDir} is not complete:`,
    `All ${expected} files of ${version} are built (macOS Apple Silicon + Intel, Windows, Linux AppImage x86_64 + arm64, Linux Flatpak).`,
  )
}

function checkPublished(version, buildDir, releaseAssets) {
  const expected = releaseArtifacts(version).length

  report(
    publishComplaints(version, buildDir, releaseAssets),
    `Error: the v${version} release does not carry the whole build:`,
    `All ${expected} files of ${version} are on the release at the size they were built.`,
  )
}

function usage() {
  console.error('Usage: verify-release.mjs built <version> <build-dir>')
  console.error('       verify-release.mjs published <version> <build-dir>   # release assets JSON on stdin')
  process.exit(1)
}

const [mode, version, buildDir] = process.argv.slice(2)

if (!version || !buildDir) {
  usage()
}

if (mode === 'built') {
  checkBuild(version, buildDir)
} else if (mode === 'published') {
  checkPublished(version, buildDir, JSON.parse(readFileSync(0, 'utf8')))
} else {
  usage()
}
