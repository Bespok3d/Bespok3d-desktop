// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildSync } from 'esbuild'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import AdmZip from 'adm-zip'
import { generateKey } from 'openpgp'
import { git, command, digest } from '../release-io.mjs'
import { releaseTooling } from '../release-tooling.mjs'

export async function integrationTools(workspace) {
  const builder = join(workspace, 'b3-builder')
  const root = mkdtempSync(join(tmpdir(), 'golive-integration-'))
  const helper = join(root, 'consumer-fixtures.mjs')
  buildSync({ entryPoints: [join(builder, 'test/action/release-event-fixtures.ts')], bundle: true, platform: 'node', format: 'esm', banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' }, define: { 'import.meta.dirname': JSON.stringify(join(builder, 'test/action')) }, outfile: helper })
  const fixtures = await import(pathToFileURL(helper).href)
  const tooling = await releaseTooling(builder, git(builder, ['rev-parse', 'HEAD']))
  const pipeline = await import(pathToFileURL(join(builder, 'dist/core/pipeline.js')).href)
  const keys = await generateKey({ type: 'ecc', userIDs: [{ name: 'fixture-only Stage04' }], format: 'armored' })
  const builderCommit = git(builder, ['rev-parse', 'HEAD'])
  const registerCommit = git(join(workspace, 'main-index'), ['rev-parse', 'HEAD'])
  return { root, workspace, fixtures, tooling, pipeline, keys, builderCommit, registerCommit }
}

export async function preparedConsumer(tools, repository) {
  const fixture = tools.fixtures.consumerCheckout(repository)
  const workflow = readFileSync(join(tools.workspace, repository, '.github/workflows/release.yml'), 'utf8').replace(/(Bespok3d\/b3-builder(?:\/\.github\/actions\/release-context)?@)[0-9a-f]{40}/g, `$1${tools.builderCommit}`).replace(/((?:register-commit:\s*|Bespok3d\/main-index\/\.github\/actions\/register-atoms@))[0-9a-f]{40}/g, `$1${tools.registerCommit}`)
  mkdirSync(join(fixture.root, '.github/workflows'), { recursive: true })
  writeFileSync(join(fixture.root, '.github/workflows/release.yml'), workflow)
  writeFileSync(join(fixture.root, '.gitignore'), 'dist/\n*.tar.gz\n*.zip\n.b3-release-context.json\ngithub-output\nprepared-release-*\n')
  git(fixture.root, ['add', '.'])
  git(fixture.root, ['commit', '-qm', 'consumer tooling contract'])
  const candidateSource = git(fixture.root, ['rev-parse', 'HEAD'])
  const manifest = repository === 'daemon' ? 'manifest.json' : repository === 'adapters' ? 'snapmaker-u1/jinni/manifest.json' : `${fixture.name}/manifest.json`
  const runtime = repository === 'daemon' ? 'version.py' : undefined
  const guard = repository === 'daemon' ? ['python3', 'scripts/tag_version_guard.py'] : ['sh', 'scripts/tag_version_guard.sh']
  const prefix = fixture.tag.slice(0, -'-v1.0.0-pre'.length)
  const candidate = await buildConsumer(tools, fixture, repository, guard, '1.0.0-pre', candidateSource, prefix)
  const candidateBytes = readFileSync(candidate.packagePath)
  tools.tooling.prepareVersion(join(fixture.root, manifest), '1.0.0-pre', runtime ? join(fixture.root, runtime) : undefined)
  git(fixture.root, ['add', manifest, ...runtime ? [runtime] : []])
  git(fixture.root, ['commit', '-qm', 'version-only Live source'])
  const liveSource = git(fixture.root, ['rev-parse', 'HEAD'])
  const live = await buildConsumer(tools, fixture, repository, guard, '1.0.0', liveSource, prefix)
  const receipt = archiveReceipt(tools, fixture, live, liveSource, prefix)
  git(fixture.root, ['remote', 'add', 'origin', `https://github.com/fixture/${repository.replaceAll('/', '-')}`])
  const unit = { name: fixture.name, repository: `fixture/${repository.replaceAll('/', '-')}`, checkout: fixture.root, version: '1.0.0-pre', sourceCommit: candidateSource, download_url: `https://fixture.example/candidate/${repository.replaceAll('/', '-')}.b3`, sha256: digest(candidateBytes), packageSignature: 'verified', daemon: repository === 'daemon', tagPrefix: prefix, guard, buildRequest: { unit: 'repo', identity: {} }, versionFields: [{ path: manifest, kind: 'manifest', candidateVersion: '1.0.0-pre' }, ...runtime ? [{ path: runtime, kind: 'daemon-runtime', candidateVersion: '1.0.0-pre' }] : []], live: { sourceCommit: liveSource, receipt } }
  return { unit, candidateBytes, liveBytes: readFileSync(live.packagePath), archive: readFileSync(join(fixture.root, 'artifact.zip')), evidence: live.evidence }
}

async function buildConsumer(tools, fixture, repository, guard, version, sourceCommit, prefix) {
  command(guard[0], [...guard.slice(1), `${prefix}-v${version}`], { cwd: fixture.root })
  rmSync(join(fixture.root, 'dist'), { recursive: true, force: true })
  if (repository === 'daemon' || repository === 'adapters') command('sh', ['scripts/stage-package.sh'], { cwd: fixture.root })
  else {
    const context = { repository: `fixture/${repository.replaceAll('/', '-')}`, sourceCommit, tag: `${prefix}-v${version}`, selectedIds: [fixture.name], releaseKind: version.endsWith('-pre') ? 'draft' : 'live', builderCommit: tools.builderCommit, registerCommit: tools.registerCommit, publish: false, preparedOnly: false }
    writeFileSync(join(fixture.root, '.b3-release-context.json'), JSON.stringify({ context }))
    command('node', [join(tools.workspace, 'b3-builder/dist/action/release-context-main.js'), 'stage-plugin-source'], { cwd: fixture.root })
  }
  if (repository === 'daemon') {
    mkdirSync(join(fixture.root, 'dist/package/bespok3d-daemon/files/wheels'), { recursive: true })
    writeFileSync(join(fixture.root, 'dist/package/bespok3d-daemon/files/wheels/fixture.whl'), 'identical synthetic dependency bytes')
  }
  const request = { unit: 'repo', sourceDir: join(fixture.root, 'dist/package'), outputDir: join(fixture.root, 'dist'), identity: { atomRepo: `fixture/${repository.replaceAll('/', '-')}` }, releaseKind: version.endsWith('-pre') ? 'draft' : 'live', selectedIds: [fixture.name], signingKey: tools.keys.privateKey }
  const result = await tools.pipeline.runPipeline(request)
  const evidence = await tools.tooling.prepareEvidence(request, result.atoms, { sourceCommit, builderCommit: tools.builderCommit, registerCommit: tools.registerCommit, releaseTag: `${prefix}-v${version}`, requireSignature: true, preparation: { runId: 101, runAttempt: 1, tag: `${prefix}-v${version}` } })
  return { packagePath: join(fixture.root, 'dist', `${fixture.name}-${version}.b3`), evidence, request }
}

function archiveReceipt(tools, fixture, live, sourceCommit, prefix) {
  command('tar', ['-czf', 'verified-unit-outputs.tar.gz', 'dist'], { cwd: fixture.root })
  const zip = new AdmZip()
  zip.addLocalFile(join(fixture.root, 'verified-unit-outputs.tar.gz'))
  zip.writeZip(join(fixture.root, 'artifact.zip'))
  return { schema: 1, repository: live.evidence.repository, sourceCommit, tag: `${prefix}-v1.0.0`, selectedIds: [fixture.name], releaseKind: 'live', builderCommit: tools.builderCommit, registerCommit: tools.registerCommit, runId: 101, runAttempt: 1, artifactId: 501, artifactDigest: `sha256:${digest(readFileSync(join(fixture.root, 'artifact.zip')))}`, archiveSha256: digest(readFileSync(join(fixture.root, 'verified-unit-outputs.tar.gz'))), evidenceSha256: digest(readFileSync(join(fixture.root, 'dist/release-evidence.json'))) }
}

export function preparationHost(prepared) {
  return { json: function (endpoint) {
    const unit = prepared.find(function (candidate) { return endpoint.includes(`repos/${candidate.unit.repository}/`) }).unit
    if (endpoint.includes('/commits/')) return { sha: unit.live.sourceCommit }
    if (endpoint.includes('/attempts/')) return { id: 101, run_attempt: 1, head_sha: unit.live.sourceCommit, event: 'workflow_dispatch', path: '.github/workflows/release.yml', status: 'completed', conclusion: 'success', repository: { id: 7, full_name: unit.repository }, head_repository: { id: 7, full_name: unit.repository } }
    return { id: 501, name: 'verified-unit-outputs', expired: false, digest: unit.live.receipt.artifactDigest, workflow_run: { id: 101, head_sha: unit.live.sourceCommit, repository_id: 7, head_repository_id: 7 } }
  }, download: function (endpoint, path) { writeFileSync(path, prepared.find(function (candidate) { return endpoint.includes(`repos/${candidate.unit.repository}/`) }).archive) } }
}
