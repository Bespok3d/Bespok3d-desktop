// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { command, git, assertEqual } from './release-io.mjs'
import { unitTag } from './golive-candidate.mjs'

export function verifySource(checkout, commit, repository, host) {
  assertEqual(git(checkout, ['rev-parse', `${commit}^{commit}`]), commit, `${repository} source object`)
  if (git(checkout, ['status', '--porcelain'])) throw new Error(`${repository}: source checkout is not clean`)
  const remote = git(checkout, ['remote', 'get-url', 'origin']).replace(/\.git$/, '')
  if (![ `git@github.com:${repository}`, `https://github.com/${repository}` ].includes(remote)) throw new Error(`${repository}: origin mismatch`)
  assertEqual(host.json(`repos/${repository}/commits/${commit}`).sha, commit, `${repository} reachable source`)
}

export function consumerPins(unit, plan) {
  const workflow = git(unit.checkout, ['show', `${unit.live.sourceCommit}:.github/workflows/release.yml`])
  const builderRefs = [...workflow.matchAll(/uses:\s*Bespok3d\/b3-builder(?:\/\.github\/actions\/release-context)?@([0-9a-f]+)/g)].map(function (match) { return match[1] })
  const registerRefs = [...workflow.matchAll(/(?:register-commit:\s*|uses:\s*Bespok3d\/main-index\/\.github\/actions\/register-atoms@)([0-9a-f]+)/g)].map(function (match) { return match[1] })
  if (builderRefs.length !== 2 || builderRefs.some(function (commit) { return commit !== plan.tooling.builder.commit })) throw new Error(`${unit.name}: consumer builder pins mismatch`)
  if (registerRefs.length < 2 || registerRefs.some(function (commit) { return commit !== plan.tooling.register.commit })) throw new Error(`${unit.name}: consumer registration pins mismatch`)
}

export function sourceArchive(checkout, commit, destination) {
  mkdirSync(destination, { recursive: true })
  const archive = execFileSync('git', ['-C', checkout, 'archive', '--format=tar', commit], { maxBuffer: 256 * 1024 * 1024 })
  writeFileSync(join(destination, 'source.tar'), archive)
  command('tar', ['-xf', join(destination, 'source.tar'), '-C', destination])
}

export function verifyUnitSource(unit, plan, services) {
  verifySource(unit.checkout, unit.live.sourceCommit, unit.repository, services.host)
  consumerPins(unit, plan)
  services.tooling.verifyVersionOnlyCommit(unit.checkout, unit.sourceCommit, unit.live.sourceCommit, unit.versionFields)
  const destination = join(services.scratch, unit.name)
  sourceArchive(unit.checkout, unit.live.sourceCommit, destination)
  command(unit.guard[0], [...unit.guard.slice(1), unitTag(unit)], { cwd: destination })
  return destination
}
