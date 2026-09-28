// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { prepareWebsite, inspectWebsite, deployWebsite } from '../golive-website.mjs'
import { git } from '../release-io.mjs'
import { websiteDownloads } from '../release-manifest.mjs'

test('website preflight is read-only; failed deploy retains exact source rewrite and resumes without discarding changes', async function () {
  const root = mkdtempSync(join(tmpdir(), 'golive-website-'))
  const source = join(root, 'website')
  const index = join(source, 'index.html')
  const original = Buffer.from('<b id="rel-version">0.7.6-beta</b>\n<!-- downloads:start -->\nold links\n<!-- downloads:end -->\n')
  const token = process.env.CLOUDFLARE_API_TOKEN
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  process.env.CLOUDFLARE_API_TOKEN = 'fixture-only-token'
  process.env.CLOUDFLARE_ACCOUNT_ID = 'fixture-only-account'
  mkdirSync(source)
  writeFileSync(index, original)
  writeFileSync(join(source, 'app.js'), 'approved script')
  git(root, ['init', '-q'])
  git(root, ['config', 'user.name', 'Fixture'])
  git(root, ['config', 'user.email', 'fixture@example.invalid'])
  git(root, ['add', '.'])
  git(root, ['commit', '-qm', 'approved website'])
  const app = join(root, 'app')
  mkdirSync(join(app, 'dist/release'), { recursive: true })
  symlinkSync(join(dirname(new URL(import.meta.url).pathname), '..'), join(app, 'scripts'))
  websiteDownloads('0.7.7-beta').forEach(function (artifact) { writeFileSync(join(app, 'dist/release', artifact.built), 'fixture') })
  const plan = { liveVersion: '0.7.7-beta', app: { checkout: app }, website: { checkout: root, directory: 'website', sourceCommit: git(root, ['rev-parse', 'HEAD']), project: 'fixture', accountId: 'fixture-only-account', url: 'https://fixture.example/website' } }
  var served = original
  const scratch = join(root, 'scratch')
  mkdirSync(scratch)
  writeFileSync(join(root, '.git/info/exclude'), 'scratch/\napp/\n*.pem\n')
  writeFileSync(join(source, 'credentials.pem'), 'private credential must never be deployed')
  const services = { scratch, http: { bytes: async function () { return served } }, deploymentFetch: async function () { return new Response(JSON.stringify({ success: true })) } }
  const calls = []
  function execute(program, args, options) { calls.push({ program, args, cwd: options.cwd }) }
  try {
    const prepared = await prepareWebsite(plan, services, execute)
    assert.equal(existsSync(join(prepared.destination, 'credentials.pem')), false)
    assert.deepEqual(readFileSync(index), original)
    assert.equal(await inspectWebsite(prepared, services), 'absent')
    assert.throws(function () { deployWebsite(prepared, function () { throw new Error('interrupted deploy') }) }, /interrupted/)
    assert.deepEqual(readFileSync(index), prepared.expected)
    const resumed = await prepareWebsite(plan, services, execute)
    writeFileSync(join(source, 'app.js'), 'changed after preflight')
    deployWebsite(resumed, execute)
    served = readFileSync(index)
    assert.equal(await inspectWebsite(resumed, services), 'equivalent')
    assert.equal(calls.at(-1).cwd, source)
    assert.equal(calls.at(-1).args[4], resumed.destination)
    assert.equal(readFileSync(join(resumed.destination, 'app.js'), 'utf8'), 'approved script')
    writeFileSync(join(source, 'app.js'), 'approved script')
    const outside = join(scratch, 'outside.html')
    writeFileSync(outside, original)
    rmSync(index)
    symlinkSync(outside, index)
    assert.throws(function () { deployWebsite(resumed, execute) }, /regular file without symlinks/)
    await assert.rejects(prepareWebsite(plan, services, execute), /regular file without symlinks/)
    assert.deepEqual(readFileSync(outside), original)
    rmSync(index)
    writeFileSync(index, 'unexpected source edit')
    await assert.rejects(prepareWebsite(plan, services, execute), /unexpected download changes/)
    writeFileSync(index, original)
    symlinkSync('/private/secret', join(source, 'external-link'))
    git(root, ['add', 'website/external-link'])
    git(root, ['commit', '-qm', 'unsafe website symlink'])
    plan.website.sourceCommit = git(root, ['rev-parse', 'HEAD'])
    await assert.rejects(prepareWebsite(plan, services, execute), /cannot contain symlinks/)
  } finally {
    if (token === undefined) delete process.env.CLOUDFLARE_API_TOKEN; else process.env.CLOUDFLARE_API_TOKEN = token
    if (account === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = account
    rmSync(root, { recursive: true, force: true })
  }
})
