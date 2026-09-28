// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { sequential } from './release-io.mjs'

export async function runGolive(plan, services, preflightOnly = false) {
  const prepared = await services.preflight(plan)
  if (preflightOnly) return prepared
  await ensureEffect('app-upload', function () { return services.inspectApp(prepared.app) }, function (inspection) { return services.publishApp(prepared.app, inspection) }, services)
  const completed = []
  await sequential(prepared.units, async function (unit) {
    await ensureEffect(`tag:${unit.name}`, function () { return services.inspectTag(unit) }, function () { return services.pushTag(unit) }, services)
    await services.waitUnitWorkflow(unit)
    await services.inspectUnitAssets(unit, true)
    await services.afterEffect(`workflow:${unit.name}`)
    completed.push(unit)
    await services.waitIndex(plan, completed)
    await services.afterEffect(`index:${unit.name}`)
    services.record(`unit:${unit.name}`, 'verified')
  })
  await services.waitIndex(plan, completed)
  await services.afterEffect('index-assembly')
  await ensureEffect('website-deployment', function () { return services.inspectWebsite(prepared.website) }, function () { return services.deployWebsite(prepared.website) }, services)
  const verified = await services.verifyLive(plan)
  services.record('served-verification', verified)
  return verified
}

async function ensureEffect(name, inspect, apply, services) {
  const inspection = await inspect()
  const state = typeof inspection === 'string' ? inspection : inspection.state
  if (state === 'equivalent') {
    services.record(name, 'reused')
    return
  }
  if (!['absent', 'partial'].includes(state)) throw new Error(`${name}: unexpected effect`)
  await apply(inspection)
  await services.afterEffect(name)
  const result = await inspect()
  if ((typeof result === 'string' ? result : result.state) !== 'equivalent') throw new Error(`${name}: effect did not verify`)
  services.record(name, 'verified')
}
