// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createRequire } from 'node:module'
import { createReadStream, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { releaseArtifacts, assetName, updaterFeeds, websiteDownloads } from './release-manifest.mjs'
import { channelFor, versionLabelError } from './channels.mjs'
import { assertEqual, digest, sequential } from './release-io.mjs'

const require = createRequire(import.meta.url)
const yaml = require('js-yaml')

async function fileHash(path, algorithm, encoding) {
  const hash = createHash(algorithm)
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest(encoding)
}

export async function verifyServedApp(app, services) {
  const channel = channelFor(app.channel ?? 'live')
  const atom = (await services.http.bytes(app.atomUrl)).toString('utf8')
  const tags = [...atom.matchAll(/<link[^>]+href="[^"]*\/releases\/tag\/([^"<]+)"/g)].map(function (match) { return decodeURIComponent(match[1]) })
  if (app.channel !== 'staging' && tags.some(function (tag) { return tag.endsWith('-staging') })) throw new Error('Staging release in Live feed')
  const version = app.version ?? tags[0]?.replace(/^v/, '')
  if (!version || versionLabelError(app.channel ?? 'live', version)) throw new Error('app feed has no valid target release')
  if (!tags.includes(`v${version}`)) throw new Error(`app feed does not list v${version}`)
  const base = app.downloadBase ?? `https://github.com/${channel.releaseRepository}/releases/download/v${version}`
  const artifacts = await sequential(releaseArtifacts(version, app.channel ?? 'live'), async function (artifact) {
    const name = assetName(artifact.built)
    const path = join(services.scratch, `app-${digest(Buffer.from(name))}`)
    await services.http.file(`${base}/${name}`, path)
    if (!statSync(path).size) throw new Error(`empty app artifact: ${name}`)
    return { name, path, size: statSync(path).size, sha256: await fileHash(path, 'sha256', 'hex'), sha512: await fileHash(path, 'sha512', 'base64') }
  })
  await verifyAppFeeds(version, app.channel ?? 'live', artifacts, function (name) { return services.http.bytes(`${base}/${name}`) })
  if (app.artifacts) {
    assertEqual(artifacts.map(function (artifact) { return { name: artifact.name, sha256: artifact.sha256 } }), app.artifacts.map(function (artifact) { return { name: artifact.name, sha256: artifact.sha256 } }), 'fresh app artifacts versus verified build')
  }
  return { version, repository: channel.releaseRepository, artifacts: artifacts.map(function ({ path, ...artifact }) { return artifact }), downloadBase: base }
}

export async function verifyAppFeeds(version, channel, artifacts, readFeed) {
  await sequential(updaterFeeds(channel), async function (name) {
    const feed = yaml.load((await readFeed(name)).toString('utf8'))
    assertEqual(feed.version, version, `${name} version`)
    if (!Array.isArray(feed.files) || !feed.files.length) throw new Error(`${name} has no files`)
    feed.files.forEach(function (file) {
      const artifact = artifacts.find(function (item) { return item.name === file.url })
      if (!artifact || !file.sha512) throw new Error(`${name} unexpected artifact ${file.url}`)
      assertEqual(file.sha512, artifact.sha512, `${name}: ${file.url} SHA512`)
      if (file.size !== undefined) assertEqual(file.size, artifact.size, `${name}: ${file.url} size`)
    })
  })
}

export async function verifyWebsite(url, app, services) {
  const html = (await services.http.bytes(url)).toString('utf8')
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/g)].map(function (match) { return match[1].replaceAll('&amp;', '&') })
  const downloads = links.filter(function (link) { return /\/releases\/download\//.test(link) })
  if (downloads.some(function (link) { return /staging|draft|-pre(?:\/|[.])/.test(link) })) throw new Error('non-Live artifact on website')
  const expected = websiteDownloads(app.version).map(function (platform) { return `${app.downloadBase}/${platform.asset}` })
  assertEqual([...new Set(downloads)].sort(), expected.sort(), 'website download links')
  await sequential(downloads, async function (link) {
    const artifact = app.artifacts.find(function (item) { return link.endsWith(`/${item.name}`) })
    if (!artifact) throw new Error(`website links unknown artifact: ${link}`)
  })
  return { url, links: downloads, status: 'verified' }
}
