// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The one list of what a finished cut is made of. A release went out with the Linux Flatpak missing
// because nothing anywhere held that list, so the build check, the publish check and the landing
// page's buttons all read it from here and cannot drift apart.
//
// `built` is the name electron-builder writes into dist/release. The name the GitHub release serves
// it under is the same with spaces turned into dashes, which is GitHub's own rule and the reason the
// Windows installer is uploaded as Bespok3d-Setup-<version>.exe while the file on disk keeps its
// spaces. `website` marks the rows the landing page offers, in the order it offers them.

// electron-updater reads these, they carry no version in their name, and a stale one left in the
// build directory from an earlier cut points every installed copy at a download that is not there.
export const UPDATER_FEEDS = ['latest-mac.yml', 'latest.yml', 'latest-linux.yml', 'latest-linux-arm64.yml']

// macOS: the .dmg people download and the .zip electron-updater installs from, Apple Silicon and
// Intel each. The page offers the Apple Silicon .dmg; Intel is taken from the GitHub release.
function macInstallers(version) {
  return [
    { built: `Bespok3d-${version}-arm64.dmg`, blockmap: true, website: { os: 'mac', arch: 'arm64', label: 'macOS', note: 'Apple Silicon' } },
    { built: `Bespok3d-${version}.dmg`, blockmap: true },
    { built: `Bespok3d-${version}-arm64-mac.zip`, blockmap: true },
    { built: `Bespok3d-${version}-mac.zip`, blockmap: true },
  ]
}

function windowsInstallers(version) {
  return [
    { built: `Bespok3d Setup ${version}.exe`, blockmap: true, website: { os: 'windows', arch: 'x64', label: 'Windows', note: 'Installer' } },
  ]
}

// The Flatpak is x86_64 only: it is assembled against the x86_64 Electron base app, which is what
// Linux desktops run. An arm64 Linux user takes the arm64 AppImage.
function linuxInstallers(version) {
  return [
    { built: `Bespok3d-${version}.AppImage`, website: { os: 'linux', arch: 'x64', label: 'Linux', note: 'AppImage x86_64' } },
    { built: `Bespok3d-${version}-arm64.AppImage`, website: { os: 'linux', arch: 'arm64', label: 'Linux', note: 'AppImage arm64' } },
    { built: `Bespok3d-${version}-x86_64.flatpak`, website: { os: 'linux', arch: 'x64', label: 'Linux', note: 'Flatpak x86_64' } },
  ]
}

export function assetName(builtName) {
  return builtName.replaceAll(' ', '-')
}

export function releaseInstallers(version) {
  return [...macInstallers(version), ...windowsInstallers(version), ...linuxInstallers(version)]
}

// A blockmap is what lets an already-installed copy download only the changed part of the next
// version, so one going missing costs every user a full download and says nothing while it does it.
function withBlockmap(installer) {
  return installer.blockmap ? [installer, { built: `${installer.built}.blockmap` }] : [installer]
}

// Everything a complete cut must have on disk and on the release: the installers, their blockmaps
// and the updater feeds.
export function releaseArtifacts(version) {
  return [
    ...releaseInstallers(version).flatMap(withBlockmap),
    ...UPDATER_FEEDS.map(function (feed) {
      return { built: feed, feed: true }
    }),
  ]
}

// The rows the landing page links, in page order.
export function websiteDownloads(version) {
  return releaseInstallers(version)
    .filter(function (installer) {
      return Boolean(installer.website)
    })
    .map(function (installer) {
      return { ...installer.website, built: installer.built, asset: assetName(installer.built) }
    })
}
