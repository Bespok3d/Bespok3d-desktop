// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { assertEqual } from './release-io.mjs'
import { verifyServedApp } from './live-app.mjs'

export async function verifyStagedApp(plan, services) {
  const staged = plan.app.staging
  const tag = services.host.tag(staged.repository, staged.tag)
  assertEqual(tag?.commit, staged.hostCommit, 'Staging host tag target')
  const release = services.host.optional(`repos/${staged.repository}/releases/tags/${staged.tag}`)
  if (!release || release.draft || !release.prerelease) throw new Error('approved Staging app is not a public prerelease')
  const served = await verifyServedApp({ version: plan.app.version, channel: 'staging', atomUrl: `https://github.com/${staged.repository}/releases.atom` }, services)
  assertEqual(served.artifacts.map(function (artifact) { return { name: artifact.name, sha256: artifact.sha256 } }), staged.artifacts, 'approved Staging artifacts')
  return served
}
