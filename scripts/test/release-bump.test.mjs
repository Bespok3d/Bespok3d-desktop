// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The public beta is plain semantic versioning with an uncounted maturity label. The alpha line
// counted its label instead ("0.1.0-alpha.36"), leaving the triple frozen at 0.1.0 forever, so the
// version said nothing about what had changed. This proves release.sh moves the triple and only the
// triple, carries the label across untouched, and refuses a bump level with no bump to apply it to.
//
// Every case runs --dry-run, which prints the bump it would make and writes nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RELEASE_SCRIPT = join(REPO_ROOT, 'scripts', 'release.sh')
const currentVersion = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).version

// Expectations are read off the shipped version rather than written in by hand, because a hand
// written next version goes stale on the very release that produces it and fails a green build.
const [shippedTriple, shippedLabel] = currentVersion.split('-')
const [shippedMajor, shippedMinor, shippedPatch] = shippedTriple.split('.').map(Number)
const label = shippedLabel ? `-${shippedLabel}` : ''

function runRelease(args) {
  return spawnSync('bash', [RELEASE_SCRIPT, ...args, '--dry-run'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
}

// The bump it would make is announced on stderr, because stdout carries the new version back to the
// caller inside the script.
function bumpTo(...args) {
  const attempt = runRelease(['bump', ...args])
  const announced = attempt.stderr.match(/DRY-RUN would bump version: \S+ -> (\S+)/)
  assert.ok(announced, `release.sh printed no bump line:\n${attempt.stderr}`)

  return announced[1]
}

function isRefused(...args) {
  return runRelease(args).status !== 0
}

test('the shipped version is plain semver with an uncounted label', () => {
  assert.match(currentVersion, /^\d+\.\d+\.\d+(-[a-z]+)?$/)
})

test('a bump raises the patch number and leaves the label alone', () => {
  assert.equal(bumpTo(), `${shippedMajor}.${shippedMinor}.${shippedPatch + 1}${label}`)
})

test('minor and major raise their own place and zero the ones below', () => {
  assert.equal(bumpTo('minor'), `${shippedMajor}.${shippedMinor + 1}.0${label}`)
  assert.equal(bumpTo('major'), `${shippedMajor + 1}.0.0${label}`)
})

test('a bump level with no bump to apply it to is refused, never ignored', () => {
  assert.ok(isRefused('minor'))
  assert.ok(isRefused('publish', 'major'))
})
