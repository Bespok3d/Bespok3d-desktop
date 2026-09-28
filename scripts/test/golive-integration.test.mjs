// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import AdmZip from 'adm-zip'
import { integrationTools, preparedConsumer, preparationHost } from './golive-integration-fixture.mjs'
import { prepareUnit } from '../golive-units.mjs'
import { verifyServedUnits } from '../live-units.mjs'
import { fixtureReader, appSurface } from './live-fixture.mjs'
import { verifyLive } from '../verify-live.mjs'
import { runGolive } from '../golive-run.mjs'
import { preflight } from '../golive-preflight.mjs'
import { digest, sequential, writeJson, git } from '../release-io.mjs'

const workspace = process.env.B3D_RELEASE_INTEGRATION_WORKSPACE

test('actual consumer guards, prepared receipts, exact package promotion and fresh served full go-live rehearsal', { skip: !workspace }, async function () {
  process.env.B3D_CONSUMER_WORKSPACE = workspace
  const tools = await integrationTools(workspace)
  const prepared = await sequential(['daemon', 'adapters', 'plugins/networking'], function (repository) { return preparedConsumer(tools, repository) })
  const files = new Map(prepared.map(function (fixture) { return [fixture.unit.download_url, fixture.candidateBytes] }))
  const scratch = mkdtempSync(join(tmpdir(), 'golive-preflight-'))
  const services = { scratch, tooling: tools.tooling, host: preparationHost(prepared), http: fixtureReader(files), publicKey: tools.keys.publicKey, publicKeys: {}, signingKey: tools.keys.privateKey }
  const plan = { tooling: { builder: { commit: tools.builderCommit }, register: { commit: tools.registerCommit } } }
  try {
    const units = await sequential(prepared, function (fixture) { return prepareUnit(fixture.unit, plan, services) })
    const entries = units.map(function (unit) { return { name: unit.name, version: '1.0.0', publisher: unit.evidence.units[0].atom.publisher, download_url: `https://fixture.example/live/${unit.name}.b3` } })
    entries.forEach(function (entry, position) { files.set(entry.download_url, prepared[position].liveBytes) })
    const indexUrl = 'https://fixture.example/index.json'
    const index = Buffer.from(JSON.stringify({ plugins: entries }))
    files.set(indexUrl, index)
    files.set(`${indexUrl}.sig`, Buffer.from(await tools.tooling.signDetached(index, tools.keys.privateKey)))
    const app = appSurface(files)
    const surface = { indexUrl, app, websiteUrl: 'https://fixture.example/website', candidates: units }
    const checked = await verifyLive(surface, services)
    assert.deepEqual(checked.units.map(function (unit) { return unit.correspondence }), ['verified', 'verified', 'verified'])
    await realPreflightRefusals(tools, prepared, services, files)
    const mutations = []
    const effects = new Set()
    const execution = {
      preflight: async function () { return { units, app, website: {} } },
      inspectApp: async function () { return effects.has('app') ? 'equivalent' : 'absent' },
      publishApp: async function () { effects.add('app'); mutations.push('app') },
      inspectTag: async function (unit) { return effects.has(unit.tag) ? 'equivalent' : 'absent' },
      pushTag: async function (unit) { effects.add(unit.tag); mutations.push(unit.tag) },
      waitUnitWorkflow: async function (unit) { assert.ok(effects.has(unit.tag)) },
      inspectUnitAssets: async function (unit) { await tools.tooling.verifyPackage(unit.livePath, tools.keys.publicKey, true) },
      waitIndex: async function () {},
      inspectWebsite: async function () { return effects.has('website') ? 'equivalent' : 'absent' },
      deployWebsite: async function () { effects.add('website'); mutations.push('website') },
      afterEffect: async function () {}, record: function () {}, verifyLive: async function () { return verifyLive(surface, services) },
    }
    await runGolive(plan, execution)
    await runGolive(plan, execution)
    assert.equal(mutations.length, 5)
    const changed = new Map(files)
    changed.set(units[0].download_url, Buffer.from('altered candidate'))
    await assert.rejects(verifyServedUnits(entries, { ...services, http: fixtureReader(changed) }, units), /bespok3d-daemon.*approved candidate/)
    const original = files.get(entries[0].download_url)
    files.set(entries[0].download_url, prepared[1].liveBytes)
    await assert.rejects(verifyServedUnits(entries, services, units), /bespok3d-daemon.*identity/)
    files.set(entries[0].download_url, original)
    const unsigned = new AdmZip(original)
    unsigned.deleteFile('manifest.json.sig')
    files.set(entries[0].download_url, unsigned.toBuffer())
    await assert.rejects(verifyServedUnits(entries, services, units), /bespok3d-daemon.*changed signature result/)
    const changedPayload = new AdmZip(original)
    const manifest = JSON.parse(changedPayload.readAsText('manifest.json'))
    const runtime = Buffer.concat([changedPayload.readFile('files/version.py'), Buffer.from('# forbidden non-version change\n')])
    changedPayload.updateFile('files/version.py', runtime)
    manifest.files.find(function (file) { return file.path === 'files/version.py' }).sha256 = digest(runtime)
    const manifestBytes = Buffer.from(JSON.stringify(manifest))
    changedPayload.updateFile('manifest.json', manifestBytes)
    changedPayload.updateFile('manifest.json.sig', Buffer.from(await tools.tooling.signDetached(manifestBytes, tools.keys.privateKey)))
    files.set(entries[0].download_url, changedPayload.toBuffer())
    await assert.rejects(verifyServedUnits(entries, services, units), /bespok3d-daemon.*non-version/)
    files.set(entries[0].download_url, original)
    if (process.env.B3D_RELEASE_EVIDENCE_PATH) writeJson(process.env.B3D_RELEASE_EVIDENCE_PATH, { tooling: plan.tooling, units: units.map(function (unit) { return { name: unit.name, candidateSource: unit.sourceCommit, liveSource: unit.live.sourceCommit, candidateSha256: unit.sha256, liveSha256: digest(readFileSync(unit.livePath)), receipt: unit.receipt } }), served: checked, mutations })
  } finally {
    prepared.forEach(function (fixture) { rmSync(fixture.unit.checkout, { recursive: true, force: true }) })
    rmSync(tools.root, { recursive: true, force: true })
    rmSync(scratch, { recursive: true, force: true })
  }
})

async function realPreflightRefusals(tools, prepared, services, files) {
  const units = prepared.map(function (fixture) { return fixture.unit })
  const candidateUrl = 'https://fixture.example/dev/index.json'
  const liveUrl = 'https://fixture.example/empty-live-index.json'
  const bytes = Buffer.from(JSON.stringify({ plugins: units.map(function (unit) { return { name: unit.name, version: unit.version, download_url: unit.download_url } }) }))
  const signature = Buffer.from(await tools.tooling.signDetached(bytes, tools.keys.privateKey))
  files.set(candidateUrl, bytes)
  files.set(`${candidateUrl}.sig`, signature)
  const baseline = Buffer.from(JSON.stringify({ plugins: [] }))
  files.set(liveUrl, baseline)
  files.set(`${liveUrl}.sig`, Buffer.from(await tools.tooling.signDetached(baseline, tools.keys.privateKey)))
  const plan = { units, candidateIndex: { url: candidateUrl, sha256: digest(bytes), signatureSha256: digest(signature) }, liveIndex: { url: liveUrl, membership: [] }, app: {}, tooling: { builder: { repository: 'Bespok3d/b3-builder', checkout: join(tools.workspace, 'b3-builder'), commit: tools.builderCommit }, register: { repository: 'Bespok3d/main-index', checkout: join(tools.workspace, 'main-index'), commit: tools.registerCommit } } }
  const originalHost = services.host
  const host = { ...originalHost, permissions: function (repository) { return { repository, fixture: true } }, tag: function () { return null }, optional: function () { return null }, json: function (endpoint) { return endpoint.includes('/commits/') ? { sha: endpoint.split('/').at(-1) } : originalHost.json(endpoint) } }
  const completeServices = { ...services, host, report: {}, saveReport: function () {}, checkGitPush: function () {} }
  const preparation = { unit: prepareUnit, app: async function () { return { repository: 'fixture/app', tag: 'v0.7.7-beta', sourceCommit: 'a'.repeat(40), artifacts: [] } }, website: async function () { return { project: 'fixture', expectedSha256: 'a'.repeat(64) } }, stagedApp: async function () {} }
  var mutations = 0
  const execution = { preflight: function () { return preflight(plan, completeServices, preparation) }, publishApp: async function () { mutations += 1 } }
  await runGolive(plan, execution, true)
  host.permissions = function () { throw new Error('missing permission') }
  await assert.rejects(runGolive(plan, execution), /missing permission/)
  host.permissions = function () { return { fixture: true } }
  const validPin = plan.tooling.builder.commit
  plan.tooling.builder.commit = '0'.repeat(40)
  await assert.rejects(runGolive(plan, execution), /Command failed|source object|unknown revision/)
  plan.tooling.builder.commit = validPin
  host.tag = function () { return { commit: '0'.repeat(40), message: '{}' } }
  await assert.rejects(runGolive(plan, execution), /tag target/)
  host.tag = function () { return null }
  git(units[0].checkout, ['tag', 'daemon-v1.0.0', units[0].sourceCommit])
  await assert.rejects(runGolive(plan, execution), /local tag target/)
  git(units[0].checkout, ['tag', '-d', 'daemon-v1.0.0'])
  completeServices.checkGitPush = function () { throw new Error('git transport permission denied') }
  await assert.rejects(runGolive(plan, execution), /git transport permission/)
  completeServices.checkGitPush = function () {}
  const saved = files.get(units[0].download_url)
  files.set(units[0].download_url, Buffer.from('altered served candidate payload'))
  await assert.rejects(runGolive(plan, execution), /approved candidate bytes/)
  files.set(units[0].download_url, saved)
  assert.equal(mutations, 0)
}
