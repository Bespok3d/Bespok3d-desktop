// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectApp, publishApp } from '../golive-app.mjs'
import { inspectTag } from '../golive-units.mjs'
import { digest, command } from '../release-io.mjs'
import { fixtureReader } from './live-fixture.mjs'

test('successful inherited-output build and deployment commands do not fail after their effects', function () {
  assert.equal(command(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'inherit' }), '')
  assert.throws(function () { command(process.execPath, ['-e', 'process.exit(7)'], { stdio: 'inherit' }) }, /Command failed/)
})

test('app publication refuses wrong target, unexpected assets and changed bytes; resumes only missing assets without clobber', async function () {
  const scratch = mkdtempSync(join(tmpdir(), 'golive-effects-'))
  const payload = Buffer.from('signed fixture artifact')
  const path = join(scratch, 'built.exe')
  writeFileSync(path, payload)
  const app = { repository: 'fixture/app', tag: 'v0.7.7-beta', sourceCommit: 'a'.repeat(40), notes: 'Approved notes', notesPath: '/fixture/release-notes.md', artifacts: [{ name: 'Bespok3d-Setup.exe', path, sha256: digest(payload) }] }
  const release = { draft: false, prerelease: false, body: app.notes, assets: [] }
  const services = { scratch, host: { tag: function () { return { commit: app.sourceCommit } }, optional: function () { return release } }, http: fixtureReader(new Map([['https://fixture.example/asset', payload]])) }
  const calls = []
  function execute(program, args) { calls.push({ program, args }) }
  try {
    const partial = await inspectApp(app, services)
    assert.equal(partial.state, 'partial')
    mkdirSync(join(scratch, app.artifacts[0].name))
    publishApp(app, partial, services, execute)
    assert.equal(statSync(calls[0].args[3]).isFile(), true)
    assert.ok(calls[0].args.includes('upload'))
    assert.ok(!calls[0].args.includes('--clobber'))
    publishApp(app, { state: 'absent', missing: app.artifacts }, services, execute)
    assert.equal(calls[1].args[calls[1].args.indexOf('--target') + 1], app.sourceCommit)
    assert.ok(calls[1].args.includes('--notes-file'))
    release.assets = [{ name: app.artifacts[0].name, browser_download_url: 'https://fixture.example/asset' }]
    assert.equal((await inspectApp(app, services)).state, 'equivalent')
    services.host.tag = function () { return { commit: 'b'.repeat(40) } }
    await assert.rejects(inspectApp(app, services), /not the built source/)
    services.host.tag = function () { return { commit: app.sourceCommit } }
    release.assets[0].name = 'unexpected.exe'
    await assert.rejects(inspectApp(app, services), /unexpected existing app asset/)
    release.assets[0].name = app.artifacts[0].name
    services.http = fixtureReader(new Map([['https://fixture.example/asset', Buffer.from('tampered')]]))
    await assert.rejects(inspectApp(app, services), /existing asset.*mismatch/)
    assert.equal(calls.length, 2)
  } finally { rmSync(scratch, { recursive: true, force: true }) }
})

test('unit tag inspector rejects changed commit, lightweight tags and altered approved receipt', function () {
  const receipt = { artifactId: 501 }
  const unit = { name: 'fixture-unit', repository: 'fixture/unit', tag: 'plugin-fixture-unit-v1.0.0', live: { sourceCommit: 'a'.repeat(40) }, receipt }
  const remote = { commit: unit.live.sourceCommit, message: JSON.stringify(receipt) }
  const services = { host: { tag: function () { return remote } }, tooling: { parseReceipt: JSON.parse } }
  assert.equal(inspectTag(unit, services), 'equivalent')
  remote.commit = 'b'.repeat(40)
  assert.throws(function () { inspectTag(unit, services) }, /tag target/)
  remote.commit = unit.live.sourceCommit
  remote.message = null
  assert.throws(function () { inspectTag(unit, services) }, /no preparation receipt/)
  remote.message = JSON.stringify({ artifactId: 502 })
  assert.throws(function () { inspectTag(unit, services) }, /tag receipt/)
})
