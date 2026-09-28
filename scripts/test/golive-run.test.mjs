// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runGolive } from '../golive-run.mjs'

function fixture(failAfter, preflightError) {
  const effects = new Set()
  const counts = new Map()
  const records = []
  const units = [{ name: 'daemon' }, { name: 'jinni' }, { name: 'selected-plugin' }]
  const prepared = { app: {}, website: {}, units }
  var injected = false
  function apply(name) { effects.add(name); counts.set(name, (counts.get(name) ?? 0) + 1) }
  function inspect(name) { return effects.has(name) ? 'equivalent' : 'absent' }
  const services = {
    preflight: async function () { if (preflightError) throw new Error(preflightError); return prepared },
    inspectApp: async function () { return { state: inspect('app-upload') } },
    publishApp: async function () { apply('app-upload') },
    inspectTag: async function (unit) { return inspect(`tag:${unit.name}`) },
    pushTag: async function (unit) { apply(`tag:${unit.name}`) },
    waitUnitWorkflow: async function (unit) { assert.ok(effects.has(`tag:${unit.name}`)); effects.add(`workflow:${unit.name}`) },
    inspectUnitAssets: async function (unit) { assert.ok(effects.has(`workflow:${unit.name}`)) },
    waitIndex: async function (plan, completed) { completed.forEach(function (unit) { effects.add(`index:${unit.name}`) }) },
    inspectWebsite: async function () { return inspect('website-deployment') },
    deployWebsite: async function () { apply('website-deployment') },
    verifyLive: async function () { assert.ok(effects.has('website-deployment')); return { verified: true } },
    record: function (name, result) { records.push({ name, result }) },
    afterEffect: async function (name) { if (name === failAfter && !injected) { injected = true; throw new Error(`injected after ${name}`) } },
  }
  return { services, counts, effects, records }
}

const boundaries = ['app-upload', ...['daemon', 'jinni', 'selected-plugin'].flatMap(function (name) { return [`tag:${name}`, `workflow:${name}`, `index:${name}`] }), 'index-assembly', 'website-deployment']
boundaries.forEach(function (boundary) {
  test(`resume after ${boundary} observes the effect without duplicate publication`, async function () {
    const state = fixture(boundary)
    await assert.rejects(runGolive({}, state.services), /injected/)
    await runGolive({}, state.services)
    assert.deepEqual([...state.counts.values()], [1, 1, 1, 1, 1])
    assert.equal(state.records.at(-1).name, 'served-verification')
  })
})

;['missing permission', 'missing tooling pin', 'tag mismatch', 'payload mismatch', 'changed approval'].forEach(function (failure) {
  test(`${failure} prevents every publishing effect`, async function () {
    const state = fixture(undefined, failure)
    await assert.rejects(runGolive({}, state.services), new RegExp(failure))
    assert.equal(state.counts.size, 0)
  })
})

test('preflight-only has no publication and unexpected existing effects stop without overwrite', async function () {
  const state = fixture()
  await runGolive({}, state.services, true)
  assert.equal(state.counts.size, 0)
  state.services.inspectApp = async function () { return { state: 'conflict' } }
  await assert.rejects(runGolive({}, state.services), /unexpected effect/)
  assert.equal(state.counts.size, 0)
})
