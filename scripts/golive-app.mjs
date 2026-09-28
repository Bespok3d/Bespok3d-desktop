// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, existsSync, symlinkSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { channelFor } from './channels.mjs'
import { releaseArtifacts, assetName } from './release-manifest.mjs'
import { command, git, digest, assertEqual, readJson } from './release-io.mjs'
import { verifySource } from './golive-sources.mjs'
import { verifyAppFeeds } from './live-app.mjs'

export async function prepareApp(plan, services) {
  const checkout = plan.app.checkout
  const repository = channelFor('live').releaseRepository
  verifySource(checkout, plan.app.sourceCommit, repository, services.host)
  assertEqual(git(checkout, ['rev-parse', 'HEAD']), plan.app.sourceCommit, 'app build checkout')
  assertEqual(readJson(join(checkout, 'package.json')).version, plan.liveVersion, 'app source version')
  const output = join(checkout, 'dist/release')
  const previous = services.report.appBuild
  if (!previous) command('bash', [join(checkout, 'scripts/release.sh'), 'live'], { cwd: checkout, stdio: 'inherit' })
  command('node', [join(checkout, 'scripts/verify-release.mjs'), 'built', plan.liveVersion, output, 'live'])
  const provenance = readJson(join(output, `.release-provenance-v${plan.liveVersion}.json`))
  assertEqual([provenance.sourceCommit, provenance.releaseTarget, provenance.releaseRepository], [plan.app.sourceCommit, 'live', repository], 'Live build provenance')
  const artifacts = releaseArtifacts(plan.liveVersion).map(function (artifact) {
    const path = join(output, artifact.built)
    const bytes = readFileSync(path)
    return { name: assetName(artifact.built), path, sha256: digest(bytes), sha512: digest(bytes, 'sha512', 'base64'), size: bytes.length }
  })
  const identity = { sourceCommit: plan.app.sourceCommit, version: plan.liveVersion, artifacts: artifacts.map(function ({ path, ...artifact }) { return artifact }) }
  if (previous) assertEqual(identity, previous, 'retained Live app build')
  await verifyAppFeeds(plan.liveVersion, 'live', artifacts, function (name) { return readFileSync(join(output, name)) })
  verifyMacSignatures(artifacts, services.scratch, plan.liveVersion)
  services.report.appBuild = identity
  services.saveReport()
  return { repository, tag: `v${plan.liveVersion}`, sourceCommit: plan.app.sourceCommit, artifacts, notes: readFileSync(join(checkout, 'release-notes.md'), 'utf8'), notesPath: join(checkout, 'release-notes.md') }
}

function verifyMacSignatures(artifacts, scratch, version) {
  if (process.platform !== 'darwin') throw new Error('Live app signature preflight requires macOS')
  artifacts.filter(function (artifact) { return artifact.name.endsWith('-mac.zip') }).forEach(function (artifact) {
    const directory = join(scratch, 'signature-checks', artifact.name)
    mkdirSync(directory, { recursive: true })
    command('ditto', ['-x', '-k', artifact.path, directory])
    verifyMacBundle(directory, version)
  })
  artifacts.filter(function (artifact) { return artifact.name.endsWith('.dmg') }).forEach(function (artifact) {
    command('hdiutil', ['verify', artifact.path])
    const mount = join(scratch, `mounted-${artifact.name}`)
    mkdirSync(mount)
    command('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, artifact.path])
    try { verifyMacBundle(mount, version) } finally { command('hdiutil', ['detach', mount]) }
  })
}

function verifyMacBundle(directory, version) {
  const bundle = readdirSync(directory).find(function (name) { return name.endsWith('.app') })
  if (!bundle) throw new Error('installer has no signed app bundle')
  const path = join(directory, bundle)
  command('codesign', ['--verify', '--deep', '--strict', path])
  command('spctl', ['--assess', '--type', 'execute', path])
  const plist = join(path, 'Contents/Info.plist')
  assertEqual(command('/usr/libexec/PlistBuddy', ['-c', 'Print CFBundleIdentifier', plist]), channelFor('live').appId, 'Live bundle identity')
  assertEqual(command('/usr/libexec/PlistBuddy', ['-c', 'Print CFBundleShortVersionString', plist]), version, 'Live bundle version')
}

export async function inspectApp(app, services) {
  const tag = services.host.tag(app.repository, app.tag)
  if (tag && tag.commit !== app.sourceCommit) throw new Error('app tag is not the built source commit')
  const release = services.host.optional(`repos/${app.repository}/releases/tags/${app.tag}`)
  if (!release) return { state: 'absent', missing: app.artifacts }
  if (!tag || release.draft || release.prerelease || release.body !== app.notes) throw new Error('existing app release kind, target or notes mismatch')
  if (release.assets.some(function (asset) { return !app.artifacts.some(function (artifact) { return artifact.name === asset.name }) })) throw new Error('unexpected existing app asset')
  await Promise.all(release.assets.map(async function (asset) {
    const expected = app.artifacts.find(function (artifact) { return artifact.name === asset.name })
    const path = join(services.scratch, `app-remote-${digest(Buffer.from(asset.name))}`)
    await services.http.file(asset.browser_download_url, path)
    assertEqual(digest(readFileSync(path)), expected.sha256, `app existing asset ${asset.name}`)
  }))
  const missing = app.artifacts.filter(function (artifact) { return !release.assets.some(function (asset) { return asset.name === artifact.name }) })
  return { state: missing.length ? 'partial' : 'equivalent', missing }
}

export function publishApp(app, inspection, services, execute = command) {
  const uploadDirectory = join(services.scratch, 'app-uploads')
  mkdirSync(uploadDirectory, { recursive: true })
  const uploads = inspection.missing.map(function (artifact) {
    const path = join(uploadDirectory, artifact.name)
    if (!existsSync(path)) symlinkSync(artifact.path, path)
    return path
  })
  if (inspection.state === 'absent') {
    execute('gh', ['release', 'create', app.tag, ...uploads, '--repo', app.repository, '--target', app.sourceCommit, '--title', app.tag.slice(1), '--prerelease=false', '--notes-file', app.notesPath])
    return
  }
  if (uploads.length) execute('gh', ['release', 'upload', app.tag, ...uploads, '--repo', app.repository])
}
