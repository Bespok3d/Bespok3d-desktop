// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approvedCandidates, inspectIndex } from '../golive-index.mjs'
import { fixtureReader } from './live-fixture.mjs'
import { digest } from '../release-io.mjs'

test('dev keeps the Live baseline plus selected candidates; changes after approval refuse; resume allows already completed later units', async function () {
  const files = new Map()
  const units = ['first', 'second'].map(function (name) { return { name, version: '2.0.0-pre', repository: 'fixture/repo', tagPrefix: 'plugin-{unit}', download_url: `https://fixture.example/${name}-pre.b3` } })
  const incumbent = { name: 'unrelated', version: '4.0.0', download_url: 'https://fixture.example/unrelated.b3' }
  const baseline = [incumbent]
  const candidateUrl = 'https://fixture.example/dev/index.json'
  const liveUrl = 'https://fixture.example/main/index.json'
  function put(url, plugins) { const bytes = Buffer.from(JSON.stringify({ plugins })); files.set(url, bytes); files.set(`${url}.sig`, Buffer.from('fixture-signature')); return digest(bytes) }
  const candidateHash = put(candidateUrl, [...units, incumbent])
  put(liveUrl, baseline)
  const plan = { units, candidateIndex: { url: candidateUrl, sha256: candidateHash, signatureSha256: digest(Buffer.from('fixture-signature')) }, liveIndex: { url: liveUrl, membership: baseline } }
  const services = { http: fixtureReader(files), publicKey: 'fixture-key', tooling: { verifyDetached: async function () { return true } } }
  assert.equal((await approvedCandidates(plan, services)).units.length, 3)
  const liveUnits = units.map(function (unit) { return { name: unit.name, version: '2.0.0', download_url: `https://github.com/fixture/repo/releases/download/plugin-${unit.name}-v2.0.0/${unit.name}-2.0.0.b3` } })
  put(liveUrl, [...baseline, ...liveUnits])
  assert.equal((await inspectIndex(plan, [units[0]], services)).equivalent, true)
  assert.equal((await inspectIndex(plan, units, services)).equivalent, true)
  put(candidateUrl, [...units, { ...incumbent, version: '4.1.0' }])
  await assert.rejects(approvedCandidates(plan, services), /approved dev index bytes/)
  plan.candidateIndex.sha256 = digest(files.get(candidateUrl))
  await assert.rejects(approvedCandidates(plan, services), /unselected dev index membership/)
  put(candidateUrl, [units[0], incumbent])
  plan.candidateIndex.sha256 = digest(files.get(candidateUrl))
  await assert.rejects(approvedCandidates(plan, services), /membership/)
  put(liveUrl, [{ ...incumbent, version: '4.1.0' }, ...liveUnits])
  await assert.rejects(inspectIndex(plan, [], services), /unselected Live/)
  put(liveUrl, [incumbent, { ...liveUnits[0], version: '3.0.0' }, liveUnits[1]])
  await assert.rejects(inspectIndex(plan, [], services), /first.*unexpected/)
})
