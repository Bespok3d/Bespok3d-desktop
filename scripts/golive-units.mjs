// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { digest, assertEqual, git } from './release-io.mjs'
import { unitTag } from './golive-candidate.mjs'
import { verifyUnitSource } from './golive-sources.mjs'
import { waitUntil } from './golive-github.mjs'

export async function prepareUnit(unit, plan, services) {
  const root = verifyUnitSource(unit, plan, services)
  const receipt = services.tooling.parseReceipt(JSON.stringify(unit.live.receipt))
  const context = { repository: unit.repository, sourceCommit: unit.live.sourceCommit, tag: unitTag(unit), selectedIds: [unit.name], releaseKind: 'live', builderCommit: plan.tooling.builder.commit, registerCommit: plan.tooling.register.commit, publish: true, preparedOnly: true }
  services.tooling.assertReceiptContext(receipt, context)
  const run = services.host.json(`repos/${unit.repository}/actions/runs/${receipt.runId}/attempts/${receipt.runAttempt}`)
  const artifact = services.host.json(`repos/${unit.repository}/actions/artifacts/${receipt.artifactId}`)
  services.tooling.assertPreparationMetadata(receipt, run, artifact)
  restoreArtifact(root, receipt, unit.repository, services)
  const evidence = await services.tooling.verifyEvidence({ ...unit.buildRequest, sourceDir: join(root, 'dist/package'), outputDir: join(root, 'dist'), identity: { ...unit.buildRequest.identity, atomRepo: unit.repository }, releaseKind: 'live', selectedIds: [unit.name], signingKey: services.signingKey }, { sourceCommit: unit.live.sourceCommit, builderCommit: plan.tooling.builder.commit, registerCommit: plan.tooling.register.commit, releaseTag: unitTag(unit), requireSignature: unit.packageSignature === 'verified' })
  const candidatePath = join(root, 'candidate.b3')
  await services.http.file(unit.download_url, candidatePath)
  assertEqual(digest(readFileSync(candidatePath)), unit.sha256, `${unit.name} approved candidate bytes`)
  await services.tooling.verifyPackage(candidatePath, services.publicKey, unit.packageSignature === 'verified')
  const livePath = join(root, 'dist', `${unit.name}-${unit.version.slice(0, -4)}.b3`)
  const liveSignature = services.tooling.packageContents(livePath).entries.has('manifest.json.sig') ? 'verified' : 'unsigned'
  assertEqual(liveSignature, unit.packageSignature, `${unit.name} changed Live signature result`)
  services.tooling.comparePromotionPackages(candidatePath, livePath, unit.version, unit.daemon === true)
  return { ...unit, root, receipt, evidence, livePath, tag: unitTag(unit), context }
}

function restoreArtifact(root, receipt, repository, services) {
  const archive = join(root, 'artifact.zip')
  services.host.download(`repos/${repository}/actions/artifacts/${receipt.artifactId}/zip`, archive)
  assertEqual(`sha256:${digest(readFileSync(archive))}`, receipt.artifactDigest, 'downloaded artifact digest')
  const zip = new AdmZip(archive)
  const entries = zip.getEntries().filter(function (entry) { return !entry.isDirectory })
  assertEqual(entries.map(function (entry) { return entry.entryName }), ['verified-unit-outputs.tar.gz'], 'prepared artifact ZIP inventory')
  writeFileSync(join(root, entries[0].entryName), entries[0].getData())
  services.tooling.restorePreparedArtifact(root, receipt)
}

export function inspectTag(unit, services) {
  const remote = services.host.tag(unit.repository, unit.tag)
  if (!remote) return 'absent'
  assertEqual(remote.commit, unit.live.sourceCommit, `${unit.name} remote tag target`)
  if (!remote.message) throw new Error(`${unit.name}: existing tag has no preparation receipt`)
  assertEqual(services.tooling.parseReceipt(remote.message), unit.receipt, `${unit.name} tag receipt`)
  return 'equivalent'
}

export function pushTag(unit, services) {
  const existing = inspectLocalTag(unit, services)
  const annotation = services.tooling.tagReceiptMessage(unit.receipt)
  if (existing === 'absent') {
    const messagePath = join(unit.root, 'tag-message.txt')
    writeFileSync(messagePath, annotation)
    git(unit.checkout, ['tag', '-a', unit.tag, unit.live.sourceCommit, '-F', messagePath])
  }
  git(unit.checkout, ['push', 'origin', `refs/tags/${unit.tag}:refs/tags/${unit.tag}`])
}

export function inspectLocalTag(unit, services) {
  if (!git(unit.checkout, ['tag', '--list', unit.tag])) return 'absent'
  assertEqual(git(unit.checkout, ['rev-parse', `${unit.tag}^{commit}`]), unit.live.sourceCommit, `${unit.name} local tag target`)
  if (git(unit.checkout, ['cat-file', '-t', `refs/tags/${unit.tag}`]) !== 'tag') throw new Error(`${unit.name}: local tag has no preparation receipt`)
  assertEqual(services.tooling.parseReceipt(git(unit.checkout, ['for-each-ref', '--format=%(contents)', `refs/tags/${unit.tag}`])), unit.receipt, `${unit.name} local tag receipt`)
  return 'equivalent'
}

export async function waitUnitWorkflow(unit, services) {
  return waitUntil(function () {
    const runs = services.host.json(`repos/${unit.repository}/actions/workflows/release.yml/runs?event=push&head_sha=${unit.live.sourceCommit}&per_page=100`).workflow_runs
    const relevant = runs.filter(function (run) { return run.head_branch === unit.tag && run.head_sha === unit.live.sourceCommit })
    const completed = relevant.find(function (run) { return run.status === 'completed' && run.conclusion === 'success' })
    if (completed) return completed
    const failed = relevant.find(function (run) { return run.status === 'completed' && run.conclusion !== 'success' })
    if (failed) throw new Error(`${unit.name}: workflow ${failed.id} failed (${failed.conclusion}); inspect and retry that run, never rebuild`)
    return null
  }, `${unit.name} tag workflow`, services.poll)
}

export async function inspectUnitAssets(unit, services, requireComplete = false) {
  const release = services.host.optional(`repos/${unit.repository}/releases/tags/${encodeURIComponent(unit.tag)}`)
  if (!release) {
    if (requireComplete) throw new Error(`${unit.name}: workflow produced no release`)
    return 'absent'
  }
  if (release.draft || release.prerelease) throw new Error(`${unit.name}: unexpected Live release kind`)
  const downloaded = new Map()
  await Promise.all(release.assets.map(async function (asset) {
    const path = join(unit.root, `remote-${digest(Buffer.from(asset.name))}`)
    await services.http.file(asset.browser_download_url, path)
    downloaded.set(asset.name, readFileSync(path))
  }))
  const host = { target: function () { return unit.live.sourceCommit }, inspect: function () { return release }, download: function (asset) { return downloaded.get(asset.name) } }
  services.tooling.preflightReleases(unit.evidence, 'live', host)
  await services.tooling.preflightPublishedList(unit.evidence, services.signingKey, 'public', host)
  if (requireComplete && Object.keys(unit.evidence.units[0].assets).some(function (name) { return !downloaded.has(name) })) throw new Error(`${unit.name}: missing published assets`)
  return 'equivalent'
}
