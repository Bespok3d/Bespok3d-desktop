// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { channelFor } from './channels.mjs'
import { assertEqual, sequential } from './release-io.mjs'
import { approvedCandidates, inspectIndex } from './golive-index.mjs'
import { prepareApp, inspectApp } from './golive-app.mjs'
import { prepareUnit, inspectTag, inspectLocalTag, inspectUnitAssets } from './golive-units.mjs'
import { prepareWebsite } from './golive-website.mjs'
import { verifySource } from './golive-sources.mjs'
import { verifyStagedApp } from './golive-staged-app.mjs'

export async function preflight(plan, services, preparation = { app: prepareApp, unit: prepareUnit, website: prepareWebsite, stagedApp: verifyStagedApp }) {
  await approvedCandidates(plan, services)
  const repositories = [...new Set([channelFor('live').releaseRepository, ...plan.units.map(function (unit) { return unit.repository }), plan.tooling.register.repository])]
  services.report.permissions = repositories.map(function (repository) { return services.host.permissions(repository) })
  ;['builder', 'register'].forEach(function (name) {
    const tooling = plan.tooling[name]
    verifySource(tooling.checkout, tooling.commit, tooling.repository, services.host)
  })
  await preparation.stagedApp(plan, services)
  if (!services.signingKey) throw new Error('existing registry signing key is unavailable for prepared evidence verification')
  const key = await services.tooling.publicHalfOfSigningKey(services.signingKey)
  assertEqual(await services.tooling.publicKeyFingerprint(key), await services.tooling.publicKeyFingerprint(services.publicKey), 'index/package signing prerequisite')
  const units = await sequential(plan.units, function (unit) { return preparation.unit(unit, plan, services) })
  await sequential(units, async function (unit) {
    inspectLocalTag(unit, services)
    const tag = inspectTag(unit, services)
    if (tag === 'absent') services.checkGitPush(unit)
    await inspectUnitAssets(unit, services)
  })
  await inspectIndex(plan, [], services)
  const app = await preparation.app(plan, services)
  await inspectApp(app, services)
  const website = await preparation.website(plan, services)
  services.report.preflight = { status: 'verified', app: { version: plan.liveVersion, sourceCommit: app.sourceCommit }, units: units.map(function (unit) { return { name: unit.name, candidateSource: unit.sourceCommit, liveSource: unit.live.sourceCommit, tag: unit.tag, receipt: unit.receipt } }), website: { project: website.project, expectedSha256: website.expectedSha256 } }
  services.saveReport()
  return { app, units, website }
}
