// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHANNEL_TABLE = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'channel-table.json'), 'utf8'))
const STAGING_VERSION_SUFFIX = CHANNEL_TABLE.staging.versionSuffix

export function channelFor(buildFlavor) {
  const channel = CHANNEL_TABLE[buildFlavor]
  if (!channel) throw new Error(`Unknown Bespok3d build flavor: ${buildFlavor}`)

  return channel
}

export function versionLabel(version) {
  return version.split('+')[0].split('-').slice(1).join('-')
}

export function liveVersion(version) {
  return version.endsWith(STAGING_VERSION_SUFFIX)
    ? version.slice(0, -STAGING_VERSION_SUFFIX.length)
    : version
}

export function versionForChannel(buildFlavor, version) {
  const channel = channelFor(buildFlavor)

  return `${liveVersion(version)}${channel.versionSuffix ?? ''}`
}

export function versionLabelError(buildFlavor, version) {
  const channel = channelFor(buildFlavor)
  if (channel.versionLabels === null || channel.versionLabels.includes(versionLabel(version))) return null

  return `${channel.productName} requires version label ${channel.versionLabels.map(label => label || '(none)').join(' or ')}; received ${version}`
}

export function channelArtifacts(productName) {
  return {
    macDmg: version => `${productName}-${version}`,
    windowsSetup: version => `${productName} Setup ${version}`,
    linuxPackage: version => `${productName}-${version}`,
  }
}

export function primaryIndexAsset(channel) {
  return channel.indexAssets[0]
}
