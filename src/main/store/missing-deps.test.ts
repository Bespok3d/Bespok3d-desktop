// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { MergedEntry } from '../registry/model'
import { declaresDependencies, missingDependencyIds } from './missing-deps'

// The published list and the copy the printer actually runs are two different builds of one plugin
// name, and only the published one wins the catalog. The new build is the one that needs the base
// plugin; the published one, an older release, needs nothing.
const PUBLISHED_RFID = {
  name: 'rfid-ntag', version: '0.1.12', trust: 'project', signer: null, registry_url: 'https://example.invalid/main-index.json', channel: 'stable', deps: [],
} as unknown as MergedEntry
const LOCAL_RFID = {
  ...PUBLISHED_RFID, version: '0.1.14', registry_url: 'local:test-bundle', deps: ['u1-base-print-task-config'],
} as unknown as MergedEntry
const BASE_PLUGIN = {
  ...PUBLISHED_RFID, name: 'u1-base-print-task-config', version: '0.1.0', registry_url: 'local:test-bundle', deps: [],
} as unknown as MergedEntry

function catalogWherePublishedWins(): MergedEntry[] {
  return [{ ...PUBLISHED_RFID, variants: [PUBLISHED_RFID, LOCAL_RFID] }, BASE_PLUGIN] as MergedEntry[]
}

// The bug this covers stranded the user mid-update: the batch sent the local build's bytes, worked out
// its dependencies from the published entry that won the catalog, added none, and the printer refused
// the plugin for a base plugin nobody had put in the batch. The report said "finished with errors" and
// offered no way out. What a package needs has to be read off the very build being sent.
describe('the dependencies a package needs are the ones its own build declares', () => {
  it('takes the requirements of the build the printer is being sent, not of the catalog winner', () => {
    expect(missingDependencyIds(catalogWherePublishedWins(), 'rfid-ntag', [], [], { sourceUrl: 'local:test-bundle', channel: 'stable' }))
      .toEqual(['u1-base-print-task-config'])
  })

  it('takes the winner\'s requirements when the plugin has no recorded source', () => {
    expect(missingDependencyIds(catalogWherePublishedWins(), 'rfid-ntag', [], [])).toEqual([])
  })

  it('leaves out a base plugin the printer is already serving', () => {
    expect(missingDependencyIds(catalogWherePublishedWins(), 'rfid-ntag', [], ['u1-base-print-task-config'], { sourceUrl: 'local:test-bundle', channel: 'stable' }))
      .toEqual([])
  })

  it('says the build being sent declares dependencies even when the winner declares none', () => {
    expect(declaresDependencies(catalogWherePublishedWins(), 'rfid-ntag', [], { sourceUrl: 'local:test-bundle', channel: 'stable' })).toBe(true)
    expect(declaresDependencies(catalogWherePublishedWins(), 'rfid-ntag', [])).toBe(false)
  })

  it('walks the chain a build declares, deepest first', () => {
    const deepBase = { ...BASE_PLUGIN, deps: ['u1-base-filament-detect'] } as unknown as MergedEntry
    const leaf = { ...BASE_PLUGIN, name: 'u1-base-filament-detect', deps: [] } as unknown as MergedEntry
    const catalog = [{ ...PUBLISHED_RFID, variants: [PUBLISHED_RFID, LOCAL_RFID] }, deepBase, leaf] as MergedEntry[]

    expect(missingDependencyIds(catalog, 'rfid-ntag', [], [], { sourceUrl: 'local:test-bundle', channel: 'stable' }))
      .toEqual(['u1-base-filament-detect', 'u1-base-print-task-config'])
  })

  it('asks for nothing at all when the catalog does not list the plugin', () => {
    expect(missingDependencyIds(catalogWherePublishedWins(), 'never-published', [], [])).toEqual([])
  })
})
