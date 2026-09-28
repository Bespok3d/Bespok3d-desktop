// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { loadCandidate, orderedPlan } from '../golive-candidate.mjs'
import { options } from '../golive.mjs'
import { writeJson } from '../release-io.mjs'

export function candidateEvidence() {
  return { schema: 1, approved: true, app: { version: '0.7.7-beta-staging', sourceCommit: 'a'.repeat(40), staging: { repository: 'Bespok3d/Bespok3d-desktop', tag: 'v0.7.7-beta-staging', hostCommit: 'a'.repeat(40) } }, candidateIndex: { sha256: 'a'.repeat(64), signatureSha256: 'b'.repeat(64) }, tooling: { builder: { repository: 'fixture/builder', commit: 'c'.repeat(40) }, register: { repository: 'fixture/index', commit: 'd'.repeat(40) } }, units: [{ name: 'fixture-unit', repository: 'fixture/unit', version: '1.0.0-pre', sourceCommit: 'e'.repeat(40), sha256: 'c'.repeat(64), packageSignature: 'verified', tagPrefix: 'plugin-{unit}', guard: ['sh', 'scripts/tag_version_guard.sh'], versionFields: [{ path: 'manifest.json', candidateVersion: '1.0.0-pre', kind: 'manifest' }], live: { sourceCommit: 'f'.repeat(40), receipt: {} } }], website: { project: 'fixture', accountId: 'fixture-account' } }
}

test('literal golive dry-run prints all ordered steps without running commands or writing files', function () {
  const root = mkdtempSync(join(tmpdir(), 'golive-dry-'))
  try {
    const evidence = candidateEvidence()
    const manifest = join(root, 'staged-app.json')
    writeJson(manifest, { version: evidence.app.version, sourceCommit: evidence.app.sourceCommit })
    writeJson(join(root, 'candidate-evidence.json'), evidence)
    const before = readdirSync(root).map(function (name) { return [name, readFileSync(join(root, name), 'utf8')] })
    const output = execFileSync('bash', [new URL('../release.sh', import.meta.url).pathname, 'golive', '--staged-manifest', manifest, '--dry-run'], { encoding: 'utf8' })
    assert.match(output, /App:.*0.7.7-beta.*--target a{40}/)
    assert.match(output, /plugin-fixture-unit-v1.0.0/)
    assert.match(output, /Index:.*Website:.*Verification:/s)
    assert.deepEqual(readdirSync(root).map(function (name) { return [name, readFileSync(join(root, name), 'utf8')] }), before)
    assert.equal(orderedPlan(loadCandidate(manifest)).length, 7)
    writeJson(manifest, { version: evidence.app.version, sourceCommit: evidence.app.sourceCommit, units: [] })
    assert.throws(function () { loadCandidate(manifest) }, /two-field/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('golive rejects target mixing and ambiguous manifest flags before any action', function () {
  assert.throws(function () { options(['staging', '--staged-manifest', 'file']) }, /unknown/)
  assert.throws(function () { options(['--staged-manifest', '--dry-run']) }, /required/)
  assert.throws(function () { options(['--staged-manifest', 'first', '--staged-manifest', 'second']) }, /unknown|one staged/)
})
