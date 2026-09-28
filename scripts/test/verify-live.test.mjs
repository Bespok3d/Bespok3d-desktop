// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateKey, createMessage, readPrivateKey, sign, readKey, readSignature, verify } from 'openpgp'
import { anonymousReader } from '../release-http.mjs'
import { servedCatalog } from '../live-index.mjs'
import { verifyServedUnits } from '../live-units.mjs'
import { verifyServedApp, verifyWebsite } from '../live-app.mjs'
import { appSurface, fixtureReader } from './live-fixture.mjs'

test('fresh verification requires every approved promoted unit exactly once at its Live version', async function () {
  const candidates = [{ name: 'required-unit', version: '2.0.0-pre' }]
  await assert.rejects(verifyServedUnits([], {}, candidates), /required-unit.*missing/)
  await assert.rejects(verifyServedUnits([{ name: 'required-unit', version: '1.0.0' }], {}, candidates), /required-unit.*missing/)
  await assert.rejects(verifyServedUnits([{ name: 'required-unit', version: '2.0.0' }, { name: 'required-unit', version: '2.0.0' }], {}, candidates), /required-unit.*ambiguous/)
  await assert.rejects(verifyServedUnits([{ name: 'required-unit', version: '2.0.0', kind: 'collection' }], {}, candidates), /required-unit.*changed to a collection/)
})

test('anonymous reader omits credentials on redirects and refuses GitHub API and credential URLs', async function () {
  const calls = []
  const reader = anonymousReader({ fetcher: async function (url, options) {
    calls.push({ url: String(url), options })
    return calls.length === 1 ? new Response(null, { status: 302, headers: { location: 'https://cdn.example/asset' } }) : new Response('asset')
  } })
  assert.equal((await reader.bytes('https://fixture.example/asset')).toString(), 'asset')
  calls.forEach(function (call) { assert.equal(call.options.credentials, 'omit'); assert.equal(call.options.cache, 'no-store'); assert.equal(call.options.headers.Authorization, undefined) })
  await assert.rejects(reader.bytes('https://api.github.com/repos/fixture/repo'), /non-anonymous/)
  await assert.rejects(reader.bytes('https://user:secret@fixture.example/asset'), /non-anonymous/)
  const redirected = anonymousReader({ fetcher: async function () { return new Response(null, { status: 302, headers: { location: 'https://api.github.com/asset' } }) } })
  await assert.rejects(redirected.bytes('https://fixture.example/asset'), /non-anonymous/)
})

test('fresh served app hashes, target isolation and complete website links', async function () {
  const files = new Map()
  const app = appSurface(files)
  const scratch = mkdtempSync(join(tmpdir(), 'served-app-'))
  const services = { http: fixtureReader(files), scratch }
  try {
    const checked = await verifyServedApp(app, services)
    assert.equal(checked.artifacts.length, 17)
    await verifyWebsite('https://fixture.example/website', checked, services)
    const pinned = { ...app, artifacts: checked.artifacts }
    const flatpak = checked.artifacts.find(function (artifact) { return artifact.name.endsWith('.flatpak') })
    const flatpakBytes = files.get(`${app.downloadBase}/${flatpak.name}`)
    files.set(`${app.downloadBase}/${flatpak.name}`, Buffer.from('altered Flatpak not referenced by updater feeds'))
    await assert.rejects(verifyServedApp(pinned, services), /fresh app artifacts/)
    files.set(`${app.downloadBase}/${flatpak.name}`, flatpakBytes)
    files.set(`${app.downloadBase}/Bespok3d-0.7.7-beta-arm64.dmg`, Buffer.from('altered installer'))
    await assert.rejects(verifyServedApp(app, services), /SHA512/)
    appSurface(files)
    files.set('https://fixture.example/releases.atom', Buffer.from('<feed><link href="https://fixture.example/releases/tag/v0.7.7-beta-staging"/></feed>'))
    await assert.rejects(verifyServedApp(app, services), /Staging release in Live feed/)
    files.set('https://fixture.example/website', Buffer.from('<a href="https://fixture.example/releases/download/v0.7.7-beta-staging/Bespok3d-Staging.exe">bad</a>'))
    await assert.rejects(verifyWebsite('https://fixture.example/website', checked, services), /non-Live/)
    const staging = appSurface(files, '0.7.7-beta-staging', 'staging')
    assert.equal((await verifyServedApp(staging, services)).version, '0.7.7-beta-staging')
  } finally { rmSync(scratch, { recursive: true, force: true }) }
})

test('each recursive served index verifies exact bytes; bad or missing signature fails', async function () {
  const keys = await generateKey({ type: 'ecc', userIDs: [{ name: 'fixture index signer' }], format: 'armored' })
  const files = new Map()
  const indexUrl = 'https://fixture.example/index.json'
  const childUrl = 'https://fixture.example/child.json'
  async function put(url, index) {
    const bytes = Buffer.from(JSON.stringify(index))
    files.set(url, bytes)
    files.set(`${url}.sig`, Buffer.from(await sign({ message: await createMessage({ binary: bytes }), signingKeys: await readPrivateKey({ armoredKey: keys.privateKey }), detached: true })))
  }
  const tooling = { verifyDetached: async function (bytes, signature, publicKey) {
    const result = await verify({ message: await createMessage({ binary: bytes }), signature: await readSignature({ armoredSignature: signature }), verificationKeys: await readKey({ armoredKey: publicKey }) })
    return result.signatures[0].verified.then(function () { return true }, function () { return false })
  } }
  await put(indexUrl, { plugins: [], lists: [{ url: childUrl }] })
  await put(childUrl, { plugins: [{ name: 'selected', version: '1.0.0-pre' }] })
  const services = { http: fixtureReader(files), tooling }
  assert.equal((await servedCatalog(indexUrl, keys.publicKey, services)).indexes.length, 2)
  files.set(childUrl, Buffer.from('{"plugins":[]}'))
  await assert.rejects(servedCatalog(indexUrl, keys.publicKey, services), /signature/)
  files.delete(`${childUrl}.sig`)
  await assert.rejects(servedCatalog(indexUrl, keys.publicKey, services), /signature/)
})
