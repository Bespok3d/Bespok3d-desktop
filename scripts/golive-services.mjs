// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { channelFor } from './channels.mjs'
import { digest, readJson, writeJson, assertEqual, git } from './release-io.mjs'
import { anonymousReader } from './release-http.mjs'
import { releaseTooling } from './release-tooling.mjs'
import { githubClient, waitUntil } from './golive-github.mjs'
import { preflight } from './golive-preflight.mjs'
import { inspectApp, publishApp } from './golive-app.mjs'
import { inspectTag, pushTag, waitUnitWorkflow, inspectUnitAssets } from './golive-units.mjs'
import { inspectWebsite, deployWebsite } from './golive-website.mjs'
import { waitIndex, approvedCandidates } from './golive-index.mjs'
import { verifyLive } from './verify-live.mjs'

export async function productionServices(plan, scratch) {
  if (process.env.BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN) process.env.GH_TOKEN = process.env.BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN
  const reportPath = join(plan.directory, 'execution-report.json')
  const approvalSha256 = digest(readFileSync(plan.evidencePath))
  const report = existsSync(reportPath) ? readJson(reportPath) : { approvalSha256, effects: [] }
  assertEqual(report.approvalSha256, approvalSha256, 'execution approval evidence')
  const services = { scratch, report, http: anonymousReader(), host: githubClient(), tooling: await releaseTooling(plan.tooling.builder.checkout, plan.tooling.builder.commit), publicKey: readFileSync(plan.publicKeyPath, 'utf8'), publicKeys: plan.publicKeys ?? {}, signingKey: process.env.REGISTRY_SIGNING_KEY || process.env.BESPOK3D_REGISTRY_SIGNING_KEY }
  services.saveReport = function () { writeJson(reportPath, report) }
  services.record = function (effect, result) { report.effects.push({ effect, result, at: new Date().toISOString() }); services.saveReport() }
  services.afterEffect = async function () {}
  services.checkGitPush = function (unit) { git(unit.checkout, ['push', '--dry-run', '--porcelain', 'origin', `${unit.live.sourceCommit}:refs/tags/${unit.tag}`]) }
  services.preflight = function () { return preflight(plan, services) }
  services.inspectApp = function (app) { return inspectApp(app, services) }
  services.publishApp = function (app, inspection) { return publishApp(app, inspection, services) }
  services.inspectTag = function (unit) { return inspectTag(unit, services) }
  services.pushTag = function (unit) { return pushTag(unit, services) }
  services.waitUnitWorkflow = function (unit) { return waitUnitWorkflow(unit, services) }
  services.inspectUnitAssets = function (unit, required) { return inspectUnitAssets(unit, services, required) }
  services.waitIndex = function (candidate, units) { return waitIndex(candidate, units, services) }
  services.inspectWebsite = function (website) { return inspectWebsite(website, services) }
  services.deployWebsite = async function (website) {
    deployWebsite(website)
    await waitUntil(async function () { return await inspectWebsite(website, services) === 'equivalent' }, 'served website', services.poll)
  }
  services.verifyLive = async function () {
    await approvedCandidates(plan, services)
    return verifyLive(liveSurface(plan, report.appBuild.artifacts), services)
  }
  return services
}

export function liveSurface(plan, artifacts) {
  return { indexUrl: plan.liveIndex.url, app: { version: plan.liveVersion, channel: 'live', atomUrl: `https://github.com/${channelFor('live').releaseRepository}/releases.atom`, artifacts }, websiteUrl: plan.website.url, candidates: plan.units }
}
