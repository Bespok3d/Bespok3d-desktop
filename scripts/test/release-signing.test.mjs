// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The Windows installer must carry no code signature and no owner name. CSC_LINK and
// CSC_KEY_PASSWORD hold the Apple Developer ID key for the macOS build, and electron-builder reads
// those same two variables for the Windows target, so a machine that exports them signed the .exe
// with a certificate Windows cannot trust and wrote the certificate owner's name into
// app-update.yml. Every installed copy then refused every later update, permanently. This proves
// both guards are in place: the variables are stripped from the Windows build, and update-time
// signature verification is off so no owner name can be recorded even if they leak back in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RELEASE_SCRIPT = join(REPO_ROOT, 'scripts', 'release.sh')
const packageManifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))

function windowsBuildCommand() {
  const attempt = spawnSync('bash', [RELEASE_SCRIPT, '--dry-run'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, CSC_LINK: '/nowhere/fake.p12', CSC_KEY_PASSWORD: 'fake' },
  })
  const printed = `${attempt.stdout}\n${attempt.stderr}`
  const announced = printed.split('\n').find((line) => line.includes('package:win'))
  assert.ok(announced, `release.sh printed no Windows build line:\n${printed}`)

  return announced
}

test('the Windows build runs without the Apple signing key in its environment', () => {
  const announced = windowsBuildCommand()
  assert.match(announced, /-u CSC_LINK\b/)
  assert.match(announced, /-u CSC_KEY_PASSWORD\b/)
  assert.match(announced, /-u WIN_CSC_LINK\b/)
  assert.match(announced, /-u WIN_CSC_KEY_PASSWORD\b/)
})

test('no owner name is recorded for the Windows updater to demand', () => {
  assert.equal(packageManifest.build.win.verifyUpdateCodeSignature, false)
})
