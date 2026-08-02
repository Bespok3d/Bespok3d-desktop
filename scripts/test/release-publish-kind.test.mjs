// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Until the public beta every cut went up as a GitHub prerelease, so the flag was hard-coded and
// nothing could say otherwise. Now 'publish' means a real release and 'pre' is what asks for a
// prerelease, which makes the difference between the two something a slip can get wrong. This proves
// each word lands on the release GitHub is told to make, and that 'pre' keeps the landing page out
// of it: a build published as one to try must never become the download the page offers.
//
// Every case runs --dry-run, which prints what it would do and uploads nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RELEASE_SCRIPT = join(REPO_ROOT, 'scripts', 'release.sh')

function runRelease(...args) {
  const attempt = spawnSync('bash', [RELEASE_SCRIPT, ...args, '--dry-run'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })

  return { ...attempt, output: `${attempt.stdout}${attempt.stderr}` }
}

// What kind of release the run would make, as the run itself announces it.
function announcedKind(...args) {
  const attempt = runRelease(...args)
  const announced = attempt.output.match(/as an? (prerelease|release)\b/)
  assert.ok(announced, `release.sh announced no release kind:\n${attempt.output}`)

  return announced[1]
}

test('publish on its own makes a real release', () => {
  assert.equal(announcedKind('publish'), 'release')
})

test('pre makes a prerelease', () => {
  assert.equal(announcedKind('pre', 'publish'), 'prerelease')
})

test('pre leaves the landing page alone even when web is asked for', () => {
  const attempt = runRelease('pre', 'publish', 'web')

  assert.equal(attempt.status, 0, attempt.output)
  assert.match(attempt.output, /'pre' never touches the landing page/)
  assert.doesNotMatch(attempt.output, /Pointing the landing page/)
})

test('pre without publish is refused, never ignored', () => {
  assert.notEqual(runRelease('pre').status, 0)
})
