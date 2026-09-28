// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { loadCandidate, orderedPlan } from './golive-candidate.mjs'
import { productionServices } from './golive-services.mjs'
import { runGolive } from './golive-run.mjs'

export function options(args) {
  const allowed = new Set(['--staged-manifest', '--dry-run', '--preflight'])
  const manifestPosition = args.indexOf('--staged-manifest')
  if (manifestPosition < 0 || !args[manifestPosition + 1] || args[manifestPosition + 1].startsWith('-')) throw new Error('--staged-manifest <path> is required')
  if (args.some(function (argument, position) { return position !== manifestPosition + 1 && !allowed.has(argument) })) throw new Error('unknown golive argument')
  if (args.filter(function (argument) { return argument === '--staged-manifest' }).length !== 1) throw new Error('one staged manifest is required')
  return { manifestPath: args[manifestPosition + 1], dryRun: args.includes('--dry-run'), preflightOnly: args.includes('--preflight') }
}

export async function main(args) {
  const requested = options(args)
  const plan = loadCandidate(requested.manifestPath)
  orderedPlan(plan).forEach(function (step, position) { console.log(`${position + 1}. ${step}`) })
  if (requested.dryRun) return
  const scratch = mkdtempSync(join(tmpdir(), 'b3-golive-'))
  try {
    const services = await productionServices(plan, scratch)
    await runGolive(plan, services, requested.preflightOnly)
    console.log(requested.preflightOnly ? 'Nonpublishing preflight verified; review execution-report.json before authorizing go-live.' : 'Live release and fresh served surface verified.')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch(function (error) { console.error(`go-live stopped: ${error.message}`); process.exitCode = 1 })
