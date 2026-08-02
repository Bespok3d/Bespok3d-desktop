// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Point the landing page's download buttons at one release: rewrite the generated
// `<!-- downloads:start/end -->` block and the `<b id="rel-version">` text, in place, and nothing
// else on the page. Called by `release.sh web`; run it by hand only to re-point a page without
// cutting anything.
//
//   node scripts/update-web-downloads.mjs <index.html> <version> <build-dir> <owner/repo> [--dry-run]
//
// The asset names here must match what electron-builder produced and what release.sh uploaded.
// GitHub replaces a space in an asset name with a dash, which is why the Windows installer is linked
// as Bespok3d-Setup-<version>.exe while the file on disk still has its spaces.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DOWNLOADS_BLOCK = /(<!-- downloads:start -->\n)[\s\S]*?(\n[ \t]*<!-- downloads:end -->)/
const SHOWN_VERSION = /(<b id="rel-version">)[^<]*(<\/b>)/

// `built` is the name on disk when it differs from the name the release serves it under.
function downloadablePlatforms(version) {
  return [
    { os: 'mac', arch: 'arm64', label: 'macOS', note: 'Apple Silicon', asset: `Bespok3d-${version}-arm64.dmg` },
    { os: 'windows', arch: 'x64', label: 'Windows', note: 'Installer', asset: `Bespok3d-Setup-${version}.exe`, built: `Bespok3d Setup ${version}.exe` },
    { os: 'linux', arch: 'x64', label: 'Linux', note: 'AppImage x86_64', asset: `Bespok3d-${version}.AppImage` },
    { os: 'linux', arch: 'arm64', label: 'Linux', note: 'AppImage arm64', asset: `Bespok3d-${version}-arm64.AppImage` },
  ]
}

function downloadRow(platform, downloadBase) {
  const href = `${downloadBase}/${platform.asset}`

  return `        <li><a class="dl" data-os="${platform.os}" data-arch="${platform.arch}" href="${href}"><span class="dl-os">${platform.label}</span><span class="dl-note">${platform.note}</span></a></li>`
}

function downloadList(platforms, downloadBase) {
  return [
    '      <ul class="dl-list" id="dl-list" aria-label="Download Bespok3d">',
    ...platforms.map(function (platform) {
      return downloadRow(platform, downloadBase)
    }),
    '      </ul>',
  ].join('\n')
}

// A link to something this host never built would 404 on the page, so it is said out loud rather
// than left for a visitor to find.
function warnAboutUnbuiltPlatforms(platforms, buildDir) {
  platforms
    .filter(function (platform) {
      return !existsSync(join(buildDir, platform.built || platform.asset))
    })
    .forEach(function (platform) {
      console.error(`Warning: ${platform.asset} is not in ${buildDir}; the page will link to a download this host never built.`)
    })
}

function updateWebDownloads(indexPath, version, buildDir, publishRepo, dryRun) {
  const downloadBase = `https://github.com/${publishRepo}/releases/download/v${version}`
  const platforms = downloadablePlatforms(version)
  const html = readFileSync(indexPath, 'utf8')

  if (!DOWNLOADS_BLOCK.test(html) || !SHOWN_VERSION.test(html)) {
    console.error(`Error: ${indexPath} has no downloads:start/end markers or no <b id="rel-version">; the page and this script disagree.`)
    process.exit(1)
  }

  warnAboutUnbuiltPlatforms(platforms, buildDir)

  if (dryRun) {
    console.log(`DRY-RUN would write ${indexPath}:`)
    platforms.forEach(function (platform) {
      console.log(`  ${platform.label} ${platform.note}: ${downloadBase}/${platform.asset}`)
    })

    return
  }

  const updated = html
    .replace(DOWNLOADS_BLOCK, `$1${downloadList(platforms, downloadBase)}$2`)
    .replace(SHOWN_VERSION, `$1${version}$2`)

  if (updated === html) {
    console.log(`Already pointing at ${version}; nothing to change.`)

    return
  }

  writeFileSync(indexPath, updated)
  console.log(`Updated ${indexPath} to ${version}. Deploy it from the bespok3d-server repo to make it live.`)
}

const [indexPath, version, buildDir, publishRepo] = process.argv.slice(2)

if (!indexPath || !version || !buildDir || !publishRepo) {
  console.error('Usage: update-web-downloads.mjs <index.html> <version> <build-dir> <owner/repo> [--dry-run]')
  process.exit(1)
}

updateWebDownloads(indexPath, version, buildDir, publishRepo, process.argv.includes('--dry-run'))
