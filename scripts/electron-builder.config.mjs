// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { channelFor, versionForChannel, versionLabelError } from './channels.mjs'

const PROJECT_COPYRIGHT = 'Copyright © 2026 Bespok3d contributors'
const BUILD_RESOURCES = 'resources'
const RELEASE_OUTPUT = './dist/release'
const PACKAGE_JSON = join(dirname(fileURLToPath(import.meta.url)), '../package.json')

function appVersionFor(buildFlavor, version) {
  if (version) return version

  const liveVersion = process.env.B3D_LIVE_VERSION ?? JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).version

  return versionForChannel(buildFlavor, liveVersion)
}

function macProtocol(channel) {
  return [{
    CFBundleURLName: 'Bespok3d Deep Link',
    CFBundleURLSchemes: [channel.scheme],
  }]
}

function publishingFor(channel) {
  if (!channel.releaseRepository) return []
  const [owner, repo] = channel.releaseRepository.split('/')

  return [{ provider: 'github', owner, repo, releaseType: channel.releaseType, channel: channel.updateChannel }]
}

export function electronBuilderConfig(buildFlavor, version) {
  const channel = channelFor(buildFlavor)
  const appVersion = appVersionFor(buildFlavor, version)

  return {
    appId: channel.appId,
    productName: channel.productName,
    extraMetadata: { version: appVersion },
    copyright: PROJECT_COPYRIGHT,
    protocols: [{ name: 'Bespok3d Deep Link', schemes: [channel.scheme] }],
    directories: { buildResources: BUILD_RESOURCES, output: RELEASE_OUTPUT },
    npmRebuild: false,
    files: ['**/*', '!dist/**', '!release/**', '!**/node_modules/cpu-features/**'],
    publish: publishingFor(channel),
    extraResources: [{ from: './dist/plugins', to: 'plugins', filter: ['*.b3', 'index.json', 'index.json.sig'] }],
    fileAssociations: [
      { ext: 'b3', name: 'Bespok3d Plugin', description: 'Signed Bespok3d plugin package', icon: 'resources/icons/b3-file.icns', role: 'Viewer' },
      { ext: 'b3p', name: 'Bespok3d Bundle', description: 'Bespok3d airgap plugin bundle', icon: 'resources/icons/b3-package.icns', role: 'Viewer' },
    ],
    mac: {
      icon: 'resources/icons/icon.icns',
      extendInfo: {
        NSLocalNetworkUsageDescription: 'Bespok3d uses the local network to discover Klipper printers.',
        CFBundleURLTypes: macProtocol(channel),
      },
      target: [
        { target: 'dmg', arch: ['arm64', 'x64'] },
        { target: 'zip', arch: ['arm64', 'x64'] },
      ],
    },
    win: { icon: 'resources/icons/icon.png', target: 'nsis', verifyUpdateCodeSignature: false },
    linux: {
      icon: 'resources/icons/icon.png',
      category: 'Utility',
      target: [{ target: 'AppImage', arch: ['x64', 'arm64'] }],
    },
    flatpak: {
      runtimeVersion: '24.08',
      baseVersion: '24.08',
      finishArgs: [
        '--socket=wayland', '--socket=x11', '--share=ipc', '--device=dri', '--socket=pulseaudio', '--filesystem=home',
        '--share=network', '--talk-name=org.freedesktop.Notifications', '--talk-name=org.freedesktop.secrets',
      ],
    },
  }
}

export default function electronBuilderConfigForEnvironment() {
  const buildFlavor = process.env.B3D_CHANNEL ?? 'live'
  const appVersion = appVersionFor(buildFlavor, process.env.B3D_VERSION)
  if (process.env.B3D_PUBLISHED_CUT === 'true') {
    const labelError = versionLabelError(buildFlavor, appVersion)
    if (labelError) throw new Error(labelError)
  }

  return electronBuilderConfig(buildFlavor, appVersion)
}
