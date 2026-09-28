// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const releaseScript = join(repositoryRoot, 'scripts', 'release.sh')

function runRelease(argumentsList) {
  const attempt = spawnSync('bash', [releaseScript, ...argumentsList, '--dry-run'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })

  return { ...attempt, output: `${attempt.stdout}${attempt.stderr}` }
}

test('Live publish selects a normal GitHub release by default', () => {
  const attempt = runRelease(['publish'])

  assert.equal(attempt.status, 0, attempt.output)
  assert.match(attempt.output, /as a release/)
})

test('Staging publish selects a prerelease and excludes the website', () => {
  const attempt = runRelease(['staging', 'publish'])

  assert.equal(attempt.status, 0, attempt.output)
  assert.match(attempt.output, /as a prerelease/)
  assert.doesNotMatch(attempt.output, /Pointing the landing page/)
})

test('Staging website requests and legacy pre targets are refused', () => {
  const stagingWeb = runRelease(['staging', 'web'])
  const legacyPre = runRelease(['pre', 'publish'])

  assert.notEqual(stagingWeb.status, 0)
  assert.match(stagingWeb.output, /Staging cannot update the website/)
  assert.notEqual(legacyPre.status, 0)
  assert.match(legacyPre.output, /explicit 'staging' target/)
})
