// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { migrationCovers, becameCollectionIds, collectionMembers, pluginBecameCollection, splitMembers } from './collections'
import { makeCollection, makePlugin } from '../test/fixtures'

const READER = makePlugin({ id: 'rfid-ntag', name: 'rfid-ntag' })
const DECODER = makePlugin({ id: 'rfid-opentag', name: 'rfid-opentag' })
const TRACKER = makePlugin({ id: 'spoolman', name: 'spoolman' })
const CATALOG = [DECODER, READER, TRACKER]

const COLLECTION = makeCollection({
  members: [
    { id: 'rfid-ntag', version: '>=0.1.6' },
    { id: 'rfid-opentag', version: '>=0.1.0' },
    { id: 'spoolman', version: '>=0.1.11' },
  ],
})

describe('collectionMembers', () => {
  it('resolves member ids to catalog plugins in the collection declared order', () => {
    expect(collectionMembers(COLLECTION, CATALOG, []).map((plugin) => plugin.id)).toEqual([
      'rfid-ntag',
      'rfid-opentag',
      'spoolman',
    ])
  })

  it('omits a member that resolves to no catalog plugin', () => {
    const collection = makeCollection({ members: [{ id: 'rfid-ntag' }, { id: 'ghost' }] })
    expect(collectionMembers(collection, CATALOG, []).map((plugin) => plugin.id)).toEqual(['rfid-ntag'])
  })
})

describe('splitMembers', () => {
  it('splits resolved members into installed vs missing against the printer ids', () => {
    const split = splitMembers(COLLECTION, CATALOG, [], ['rfid-ntag'])
    expect(split.installed.map((plugin) => plugin.id)).toEqual(['rfid-ntag'])
    expect(split.missing.map((plugin) => plugin.id)).toEqual(['rfid-opentag', 'spoolman'])
    expect(split.unavailable).toEqual([])
  })

  it('treats every resolved member as missing when nothing is installed', () => {
    const split = splitMembers(COLLECTION, CATALOG, [], [])
    expect(split.installed).toEqual([])
    expect(split.missing.map((plugin) => plugin.id)).toEqual(['rfid-ntag', 'rfid-opentag', 'spoolman'])
  })

  it('reports a member id that is not in the catalog as unavailable', () => {
    const collection = makeCollection({ members: [{ id: 'rfid-ntag' }, { id: 'ghost', version: '>=1.0.0' }] })
    const split = splitMembers(collection, CATALOG, [], ['rfid-ntag'])
    expect(split.installed.map((plugin) => plugin.id)).toEqual(['rfid-ntag'])
    expect(split.missing).toEqual([])
    expect(split.unavailable).toEqual([{ id: 'ghost', version: '>=1.0.0' }])
  })
})

const RFID_PACK = makeCollection({
  id: 'rfid-pack', name: 'rfid-pack',
  members: [{ id: 'rfid-ntag', version: '>=0.1.6' }, { id: 'rfid-opentag', version: '>=0.1.0' }],
})

// A collection member may itself be a collection (klipper-motion inside performance-pack): it expands
// to that collection's plugins in place, in declared order.
describe('nested collections', () => {
  it('expands a member that is itself a collection to that collection plugins, in place', () => {
    const outer = makeCollection({ id: 'outer', members: [{ id: 'rfid-pack' }, { id: 'spoolman' }] })
    expect(collectionMembers(outer, CATALOG, [RFID_PACK]).map((plugin) => plugin.id)).toEqual([
      'rfid-ntag',
      'rfid-opentag',
      'spoolman',
    ])
  })

  it('installs a plugin reached both directly and through a nested collection once', () => {
    const outer = makeCollection({ id: 'outer', members: [{ id: 'rfid-ntag' }, { id: 'rfid-pack' }] })
    expect(collectionMembers(outer, CATALOG, [RFID_PACK]).map((plugin) => plugin.id)).toEqual([
      'rfid-ntag',
      'rfid-opentag',
    ])
  })

  it('splits nested members against the printer ids like direct ones', () => {
    const outer = makeCollection({ id: 'outer', members: [{ id: 'rfid-pack' }, { id: 'spoolman' }] })
    const split = splitMembers(outer, CATALOG, [RFID_PACK], ['rfid-opentag'])
    expect(split.installed.map((plugin) => plugin.id)).toEqual(['rfid-opentag'])
    expect(split.missing.map((plugin) => plugin.id)).toEqual(['rfid-ntag', 'spoolman'])
  })

  it('surfaces a nested collection unresolved member as unavailable at the top', () => {
    const holed = makeCollection({ id: 'holed-pack', name: 'holed-pack', members: [{ id: 'ghost', version: '>=1.0.0' }] })
    const outer = makeCollection({ id: 'outer', members: [{ id: 'holed-pack' }] })
    const split = splitMembers(outer, CATALOG, [holed], [])
    expect(split.missing).toEqual([])
    expect(split.unavailable).toEqual([{ id: 'ghost', version: '>=1.0.0' }])
  })

  it('treats a membership cycle as unavailable instead of hanging', () => {
    const packA = makeCollection({ id: 'pack-a', name: 'pack-a', members: [{ id: 'pack-b' }, { id: 'spoolman' }] })
    const packB = makeCollection({ id: 'pack-b', name: 'pack-b', members: [{ id: 'pack-a' }, { id: 'rfid-ntag' }] })
    const split = splitMembers(packA, CATALOG, [packA, packB], [])
    expect(split.missing.map((plugin) => plugin.id)).toEqual(['rfid-ntag', 'spoolman'])
    expect(split.unavailable).toEqual([{ id: 'pack-a' }])
  })
})

// klipper-motion was a plugin through 0.1.3 and is a collection under the same id since 0.1.4: an
// installed id that matches a catalog collection id marks that collection as carrying a migration.
describe('pluginBecameCollection', () => {
  const MOTION = makeCollection({ id: 'klipper-motion', name: 'klipper-motion' })

  it('flags a collection whose id the printer has installed as a plugin', () => {
    expect(pluginBecameCollection(MOTION, ['klipper-motion', 'spoolman'])).toBe(true)
  })

  it('leaves a collection alone when nothing installed carries its id', () => {
    expect(pluginBecameCollection(MOTION, ['spoolman'])).toBe(false)
  })
})

describe('becameCollectionIds', () => {
  const MOTION = makeCollection({ id: 'klipper-motion', name: 'klipper-motion' })

  it('lists only the collections whose ids are installed as plugins', () => {
    expect(becameCollectionIds([MOTION, RFID_PACK], ['klipper-motion'])).toEqual(['klipper-motion'])
  })

  it('is empty when no installed id matches a collection', () => {
    expect(becameCollectionIds([MOTION, RFID_PACK], ['spoolman'])).toEqual([])
  })
})

describe('migrationCovers', () => {
  const terms = { summary: 'The base layer holds those files now.', fromVersion: '0.1.10', untilVersion: '0.1.14' }

  it('covers the installed copies the publisher wrote the move for', () => {
    expect(migrationCovers(terms, '0.1.10')).toBe(true)
    expect(migrationCovers(terms, '0.1.13')).toBe(true)
  })

  it('leaves a printer further back than the move was written for alone', () => {
    expect(migrationCovers(terms, '0.1.9')).toBe(false)
  })

  it('leaves a printer that has already made the move alone', () => {
    expect(migrationCovers(terms, '0.1.14')).toBe(false)
    expect(migrationCovers(terms, '0.2.0')).toBe(false)
  })

  it('covers every installed copy when the publisher named no versions at all', () => {
    expect(migrationCovers({ summary: 'Everything moves.' }, '0.0.1')).toBe(true)
  })
})
