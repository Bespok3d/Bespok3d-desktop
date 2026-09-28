// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { writeFileSync } from 'node:fs'
import { releaseArtifacts, assetName, updaterFeeds, websiteDownloads } from '../release-manifest.mjs'
import { digest } from '../release-io.mjs'

export function appSurface(files, version = '0.7.7-beta', channel = 'live') {
  const base = `https://fixture.example/releases/download/v${version}`
  const artifacts = releaseArtifacts(version, channel)
  artifacts.forEach(function (artifact) { files.set(`${base}/${assetName(artifact.built)}`, Buffer.from(`fixture ${artifact.built}`)) })
  const installer = assetName(artifacts[0].built)
  const payload = files.get(`${base}/${installer}`)
  updaterFeeds(channel).forEach(function (name) { files.set(`${base}/${name}`, Buffer.from(`version: ${version}\nfiles:\n  - url: ${installer}\n    sha512: ${digest(payload, 'sha512', 'base64')}\n    size: ${payload.length}\n`)) })
  files.set('https://fixture.example/releases.atom', Buffer.from(`<feed><entry><link href="https://fixture.example/releases/tag/v${version}"/></entry></feed>`))
  files.set('https://fixture.example/website', Buffer.from(websiteDownloads(version, channel).map(function (platform) { return `<a href="${base}/${platform.asset}">download</a>` }).join('\n')))
  return { atomUrl: 'https://fixture.example/releases.atom', version, channel, downloadBase: base }
}

export function fixtureReader(files, calls = []) {
  async function bytes(url, optional = false) {
    calls.push(url)
    if (!files.has(url) && !optional) throw new Error(`404 ${url}`)
    return files.get(url) ?? null
  }
  async function file(url, path) { writeFileSync(path, await bytes(url)); return path }
  return { bytes, file }
}
