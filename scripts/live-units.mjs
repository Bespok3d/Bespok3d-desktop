// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { digest, assertEqual, sequential } from './release-io.mjs'

export async function verifyServedUnits(units, services, candidates = []) {
  candidates.forEach(function (candidate) {
    const matches = units.filter(function (unit) { return unit.name === candidate.name })
    if (matches.length !== 1 || matches[0].version !== candidate.version.slice(0, -4)) throw new Error(`${candidate.name}: promoted unit missing or ambiguous in served Live catalog`)
  })
  return sequential(units, async function (unit) {
    try {
      return await verifyUnit(unit, services, candidates.find(function (candidate) { return candidate.name === unit.name }))
    } catch (error) {
      throw new Error(`${unit.name}: ${error.message}`, { cause: error })
    }
  })
}

async function verifyUnit(unit, services, candidate) {
  if (candidate && unit.kind === 'collection') throw new Error('approved package changed to a collection')
  if (unit.kind === 'collection') return { name: unit.name, version: unit.version, packageSignature: 'not-applicable', correspondence: 'not-applicable' }
  if (!unit.download_url) throw new Error('missing download_url')
  const path = join(services.scratch, `served-${digest(Buffer.from(unit.download_url))}.b3`)
  await services.http.file(unit.download_url, path)
  const key = services.publicKeys[unit.publisher] ?? services.publicKey
  const manifest = await services.tooling.verifyPackage(path, key, false)
  assertEqual([manifest.name, manifest.version], [unit.name, unit.version], 'served package identity')
  const contents = services.tooling.packageContents(path)
  const signature = contents.entries.has('manifest.json.sig') ? 'verified' : 'unsigned'
  const result = { name: unit.name, version: unit.version, download_url: unit.download_url, sha256: digest(readFileSync(path)), packageSignature: signature, correspondence: 'unavailable: no approved staged counterpart' }
  if (candidate) await compareCandidate(candidate, path, result, services, key)
  return result
}

async function compareCandidate(candidate, livePath, result, services, publicKey) {
  const candidatePath = join(services.scratch, `candidate-${digest(Buffer.from(candidate.download_url))}.b3`)
  await services.http.file(candidate.download_url, candidatePath)
  assertEqual(digest(readFileSync(candidatePath)), candidate.sha256, `${candidate.name} approved candidate payload`)
  await services.tooling.verifyPackage(candidatePath, publicKey, candidate.packageSignature === 'verified')
  const signature = services.tooling.packageContents(candidatePath).entries.has('manifest.json.sig') ? 'verified' : 'unsigned'
  assertEqual(signature, candidate.packageSignature, `${candidate.name} candidate signature result`)
  assertEqual(result.packageSignature, candidate.packageSignature, `${candidate.name} changed signature result`)
  services.tooling.comparePromotionPackages(candidatePath, livePath, candidate.version, candidate.daemon === true)
  result.candidateSignature = signature
  result.correspondence = 'verified'
}
