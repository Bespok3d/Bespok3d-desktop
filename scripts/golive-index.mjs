// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { assertEqual } from './release-io.mjs'
import { servedCatalog, candidateMembership } from './live-index.mjs'
import { waitUntil } from './golive-github.mjs'

export async function approvedCandidates(plan, services) {
  const catalog = await servedCatalog(plan.candidateIndex.url, services.publicKey, services)
  assertEqual(catalog.indexes[0].sha256, plan.candidateIndex.sha256, 'approved dev index bytes')
  assertEqual(catalog.indexes[0].signatureSha256, plan.candidateIndex.signatureSha256, 'approved dev index signature')
  const expected = plan.units.map(function (unit) { return { name: unit.name, version: unit.version, download_url: unit.download_url } }).sort(function (earlier, later) { return earlier.name.localeCompare(later.name) })
  const selected = new Set(plan.units.map(function (unit) { return unit.name }))
  const membership = candidateMembership(catalog)
  assertEqual(membership.filter(function (entry) { return selected.has(entry.name) }), expected, 'approved candidate membership')
  assertEqual(membership.filter(function (entry) { return !selected.has(entry.name) }), plan.liveIndex.membership.filter(function (entry) { return !selected.has(entry.name) }), 'unselected dev index membership')
  return catalog
}

export async function inspectIndex(plan, completed, services) {
  const catalog = await servedCatalog(plan.liveIndex.url, services.publicKey, services)
  const actual = candidateMembership(catalog)
  const selected = new Set(plan.units.map(function (unit) { return unit.name }))
  const unchangedActual = actual.filter(function (unit) { return !selected.has(unit.name) })
  const unchangedExpected = plan.liveIndex.membership.filter(function (unit) { return !selected.has(unit.name) })
  assertEqual(unchangedActual, unchangedExpected, 'unselected Live index membership')
  plan.units.forEach(function (unit) {
    const entry = actual.find(function (entry) { return entry.name === unit.name })
    const baseline = plan.liveIndex.membership.find(function (entry) { return entry.name === unit.name })
    if (JSON.stringify(entry) !== JSON.stringify(baseline) && JSON.stringify(entry) !== JSON.stringify(liveEntry(unit))) throw new Error(`${unit.name}: unexpected Live index entry`)
  })
  return { equivalent: completed.every(function (unit) { return JSON.stringify(actual.find(function (entry) { return entry.name === unit.name })) === JSON.stringify(liveEntry(unit)) }), catalog }
}

function liveEntry(unit) {
  const tag = unit.tag ?? `${unit.tagPrefix.replace('{unit}', unit.name)}-v${unit.version.slice(0, -4)}`
  return { name: unit.name, version: unit.version.slice(0, -4), download_url: `https://github.com/${unit.repository}/releases/download/${tag}/${unit.name}-${unit.version.slice(0, -4)}.b3` }
}

export async function waitIndex(plan, completed, services) {
  return waitUntil(async function () {
    const result = await inspectIndex(plan, completed, services)
    return result.equivalent ? result.catalog : null
  }, 'signed Live index assembly', services.poll)
}
