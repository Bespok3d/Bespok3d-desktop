// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { dirname, resolve } from 'node:path'
import { readJson, requireText, assertEqual } from './release-io.mjs'
import { channelFor, liveVersion, versionLabelError } from './channels.mjs'

const SHA = /^[0-9a-f]{40}$/
const HASH = /^[0-9a-f]{64}$/
const SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

export function loadCandidate(manifestPath) {
  const manifest = readJson(manifestPath)
  const evidencePath = resolve(dirname(manifestPath), 'candidate-evidence.json')
  const evidence = readJson(evidencePath)
  assertEqual(Object.keys(manifest).sort(), ['sourceCommit', 'version'], 'two-field staged app manifest')
  requireText(manifest.sourceCommit, 'app source commit', SHA)
  if (!manifest.version?.endsWith('-staging') || versionLabelError('staging', manifest.version)) throw new Error('invalid staged app version')
  if (evidence.schema !== 1 || evidence.approved !== true) throw new Error('candidate has no recorded owner approval')
  assertEqual([evidence.app.version, evidence.app.sourceCommit], [manifest.version, manifest.sourceCommit], 'approved staged app')
  assertEqual(evidence.app.staging.repository, channelFor('staging').releaseRepository, 'Staging host provenance')
  assertEqual(evidence.app.staging.tag, `v${manifest.version}`, 'Staging tag')
  requireText(evidence.app.staging.hostCommit, 'Staging host commit', SHA)
  validateEvidence(evidence)
  return { ...evidence, manifestPath: resolve(manifestPath), evidencePath, directory: dirname(resolve(manifestPath)), liveVersion: liveVersion(manifest.version) }
}

function validateEvidence(evidence) {
  requireText(evidence.candidateIndex.sha256, 'approved dev index hash', HASH)
  requireText(evidence.candidateIndex.signatureSha256, 'approved prerelease signature hash', HASH)
  if (!Array.isArray(evidence.units) || !evidence.units.length) throw new Error('approved candidate unit set is empty')
  if (new Set(evidence.units.map(function (unit) { return unit.name })).size !== evidence.units.length) throw new Error('duplicate candidate unit')
  evidence.units.forEach(validateUnit)
  ;['builder', 'register'].forEach(function (name) {
    requireText(evidence.tooling[name].commit, `${name} commit`, SHA)
    requireText(evidence.tooling[name].repository, `${name} repository`, SLUG)
  })
  if (!evidence.website.project || !evidence.website.accountId) throw new Error('website deployment prerequisites missing')
}

function validateUnit(unit) {
  requireText(unit.name, 'unit ID', /^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  requireText(unit.repository, `${unit.name} repository`, SLUG)
  requireText(unit.sourceCommit, `${unit.name} candidate source`, SHA)
  requireText(unit.live?.sourceCommit, `${unit.name} prepared Live source`, SHA)
  requireText(unit.sha256, `${unit.name} approved package hash`, HASH)
  if (!unit.version?.endsWith('-pre')) throw new Error(`${unit.name}: candidate version must end in -pre`)
  if (!['verified', 'unsigned'].includes(unit.packageSignature)) throw new Error(`${unit.name}: invalid approved signature outcome`)
  if (!unit.live.receipt || !Array.isArray(unit.versionFields) || !unit.versionFields.length) throw new Error(`${unit.name}: exact Live preparation receipt/version fields missing`)
  if (!Array.isArray(unit.guard) || !unit.guard.length) throw new Error(`${unit.name}: actual consumer guard is missing`)
  if (unit.versionFields.some(function (field) { return !['manifest', 'daemon-runtime'].includes(field.kind) || field.path.startsWith('/') || field.path.split('/').includes('..') })) throw new Error(`${unit.name}: invalid version field`)
}

export function unitTag(unit) {
  return `${unit.tagPrefix.replace('{unit}', unit.name)}-v${unit.version.slice(0, -4)}`
}

export function orderedPlan(plan) {
  return [
    'Preflight: frozen approval, fresh prerelease source, exact source/version fields, reachable tooling pins, permissions, verified app/unit outputs, tags/assets, index signing and website prerequisites',
    `App: build Live ${plan.liveVersion} from ${plan.app.sourceCommit} with release.sh; verify; publish v${plan.liveVersion} --target ${plan.app.sourceCommit} with release-notes.md`,
    ...plan.units.flatMap(function (unit) { return [`Unit ${unit.name}: inspect/create annotated ${unitTag(unit)} at ${unit.live.sourceCommit}; push this one tag; wait for exact workflow and verify assets`, `Index: wait for ${unit.name} ${unit.version.slice(0, -4)} and preserve other entries`] }),
    'Index: verify independently signed served Live catalog and all promoted payloads',
    `Website: rewrite stable download block; deploy ${plan.website.project}; verify served HTML`,
    'Verification: anonymously re-fetch app/feed bytes, signed indexes, packages and website; compare against frozen candidate evidence',
  ]
}
