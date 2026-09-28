// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { anonymousReader } from './release-http.mjs'
import { releaseTooling } from './release-tooling.mjs'
import { readJson } from './release-io.mjs'
import { servedCatalog, candidateMembership } from './live-index.mjs'
import { verifyServedUnits } from './live-units.mjs'
import { verifyServedApp, verifyWebsite } from './live-app.mjs'

export async function verifyLive(surface, services) {
  const catalog = await servedCatalog(surface.indexUrl, services.publicKey, services)
  const units = await verifyServedUnits(catalog.units, services, surface.candidates)
  const app = await verifyServedApp(surface.app, services)
  const website = await verifyWebsite(surface.websiteUrl, app, services)
  return { checkedAt: new Date().toISOString(), indexes: catalog.indexes, membership: candidateMembership(catalog), units, app, website }
}

async function main(args) {
  const [surfacePath, builderDirectory, publicKeyPath] = args
  if (!surfacePath || !builderDirectory || !publicKeyPath) throw new Error('Usage: verify-live.mjs <surface.json> <pinned-builder-checkout> <public-key.asc>')
  const surface = readJson(surfacePath)
  const scratch = mkdtempSync(join(tmpdir(), 'b3-live-verification-'))
  try {
    const result = await verifyLive(surface, { http: anonymousReader(), tooling: await releaseTooling(builderDirectory, surface.builderCommit), publicKey: readFileSync(publicKeyPath, 'utf8'), publicKeys: surface.publicKeys ?? {}, scratch })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(function (error) { console.error(error.message); process.exitCode = 1 })
}
