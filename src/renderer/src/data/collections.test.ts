// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { collectionMembers, splitMembers } from './collections'
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
    expect(collectionMembers(COLLECTION, CATALOG).map((plugin) => plugin.id)).toEqual([
      'rfid-ntag',
      'rfid-opentag',
      'spoolman',
    ])
  })

  it('omits a member that resolves to no catalog plugin', () => {
    const collection = makeCollection({ members: [{ id: 'rfid-ntag' }, { id: 'ghost' }] })
    expect(collectionMembers(collection, CATALOG).map((plugin) => plugin.id)).toEqual(['rfid-ntag'])
  })
})

describe('splitMembers', () => {
  it('splits resolved members into installed vs missing against the printer ids', () => {
    const split = splitMembers(COLLECTION, CATALOG, ['rfid-ntag'])
    expect(split.installed.map((plugin) => plugin.id)).toEqual(['rfid-ntag'])
    expect(split.missing.map((plugin) => plugin.id)).toEqual(['rfid-opentag', 'spoolman'])
    expect(split.unavailable).toEqual([])
  })

  it('treats every resolved member as missing when nothing is installed', () => {
    const split = splitMembers(COLLECTION, CATALOG, [])
    expect(split.installed).toEqual([])
    expect(split.missing.map((plugin) => plugin.id)).toEqual(['rfid-ntag', 'rfid-opentag', 'spoolman'])
  })

  it('reports a member id that is not in the catalog as unavailable', () => {
    const collection = makeCollection({ members: [{ id: 'rfid-ntag' }, { id: 'ghost', version: '>=1.0.0' }] })
    const split = splitMembers(collection, CATALOG, ['rfid-ntag'])
    expect(split.installed.map((plugin) => plugin.id)).toEqual(['rfid-ntag'])
    expect(split.missing).toEqual([])
    expect(split.unavailable).toEqual([{ id: 'ghost', version: '>=1.0.0' }])
  })
})
