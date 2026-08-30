// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { buildUpdatePlan, pendingMigrations, updateAllCount, planIsEmpty } from './migrations'
import { makeCollection, makePlugin, makeSource } from '../../test/fixtures'

// klipper-motion as it actually is: a plugin through 0.1.3, a collection of the three base-layer
// plugins from 0.1.4 on. spoolman is an ordinary plugin with a newer build, riding the same press.
const TOOLHEAD = makePlugin({ id: 'u1-base-toolhead', name: 'u1-base-toolhead', version: '0.1.0' })
const SHAPER = makePlugin({ id: 'u1-base-shaper-calibrate', name: 'u1-base-shaper-calibrate', version: '0.1.0' })
const TRACKER = makePlugin({ id: 'spoolman', name: 'spoolman', version: '0.1.30' })
const CATALOG = [TOOLHEAD, SHAPER, TRACKER]

const MOTION = makeCollection({
  id: 'klipper-motion', name: 'klipper-motion', title: 'Klipper motion', version: '0.1.4',
  members: [{ id: 'u1-base-toolhead' }, { id: 'u1-base-shaper-calibrate' }],
})

const INSTALLED = { versions: { 'klipper-motion': '0.1.3', spoolman: '0.1.29' } }

describe('pendingMigrations', () => {
  it('reads an installed plugin that is now a collection as one migration carrying its members', () => {
    const migrations = pendingMigrations([MOTION], CATALOG, ['klipper-motion', 'spoolman'], INSTALLED, {})
    expect(migrations).toHaveLength(1)
    expect(migrations[0].migratingPluginId).toBe('klipper-motion')
    expect(migrations[0].arrivingSpecs.map((spec) => spec.pluginId)).toEqual(['u1-base-toolhead', 'u1-base-shaper-calibrate'])
  })

  it('leaves a member the printer already carries out of the specs, so it is not installed twice', () => {
    const migrations = pendingMigrations([MOTION], CATALOG, ['klipper-motion', 'u1-base-toolhead'], INSTALLED, {})
    expect(migrations[0].arrivingSpecs.map((spec) => spec.pluginId)).toEqual(['u1-base-shaper-calibrate'])
  })

  it('finds nothing to migrate on a printer carrying no retired plugin', () => {
    expect(pendingMigrations([MOTION], CATALOG, ['spoolman'], INSTALLED, {})).toEqual([])
  })

  // The publisher declared which installed copies the takeover was written for. A printer left further
  // back than that is not swept into a move nobody wrote for it, and is left where it is.
  it('leaves a printer whose installed copy is older than the declared terms alone', () => {
    const declared = { ...MOTION, migration: { summary: 'The base layer owns the patching now.', fromVersion: '0.1.3' } }
    expect(pendingMigrations([declared], CATALOG, ['klipper-motion'], { versions: { 'klipper-motion': '0.1.2' } }, {})).toEqual([])
    expect(pendingMigrations([declared], CATALOG, ['klipper-motion'], { versions: { 'klipper-motion': '0.1.3' } }, {})).toHaveLength(1)
  })
})

// rfid-ntag as it actually is: it keeps its id and its place on the printer, and from 0.1.14 the base
// layer holds the Klipper files it used to patch itself, so it arrives with the plugins that hold them.
const RFID_TERMS = { summary: 'The base layer holds those files now.', untilVersion: '0.1.14' }
const READER = makePlugin({ id: 'u1-base-fm175xx-reader', name: 'u1-base-fm175xx-reader', version: '0.1.0' })
const RFID = makePlugin({ id: 'rfid-ntag', name: 'rfid-ntag', version: '0.1.14', deps: ['u1-base-fm175xx-reader'], migration: RFID_TERMS })

describe('a plugin that changes what it does without changing its id', () => {
  it('is a migration that leaves the plugin on the printer', () => {
    const migrations = pendingMigrations([], [RFID, READER], ['rfid-ntag'], { versions: { 'rfid-ntag': '0.1.12' } }, {})
    expect(migrations).toHaveLength(1)
    expect(migrations[0].migratingPluginId).toBe('rfid-ntag')
    expect(migrations[0].comingOffThePrinter).toBe(false)
    expect(migrations[0].arrivingSpecs.map((spec) => spec.pluginId)).toEqual(['rfid-ntag'])
  })

  it('brings the plugins its new shape needs with it', () => {
    const migrations = pendingMigrations([], [RFID, READER], ['rfid-ntag'], { versions: { 'rfid-ntag': '0.1.12' } }, {})
    expect(migrations[0].arrivingSpecs[0].depIds).toEqual(['u1-base-fm175xx-reader'])
  })

  it('is not sent twice: the press updates it as the migration, not as an ordinary update as well', () => {
    const plan = buildUpdatePlan([RFID, READER], [], ['rfid-ntag'], { versions: { 'rfid-ntag': '0.1.12' } }, {})
    expect(plan.updates.map((spec) => spec.pluginId)).toEqual([])
    expect(updateAllCount(plan)).toBe(1)
  })

  // A printer that has already made the move reads its next update as an update, not as the same
  // explanation all over again.
  it('leaves a printer already carrying the new shape with an ordinary update', () => {
    const later = { ...RFID, version: '0.1.15' }
    const plan = buildUpdatePlan([later, READER], [], ['rfid-ntag'], { versions: { 'rfid-ntag': '0.1.14' } }, {})
    expect(plan.migrations).toEqual([])
    expect(plan.updates.map((spec) => spec.pluginId)).toEqual(['rfid-ntag'])
  })
})

// The same plugin is listed by the published index and by the offline copy this build carries. The
// published row is older and knows nothing about the change; the version the app actually offers is
// the newer one on the other list, and that is the one that declares it.
const PUBLISHED_LIST = 'github:Bespok3d/main-index/index.json'
const OFFLINE_COPY = '/bundled/index.json'
const RFID_FROM_TWO_LISTS = makePlugin({
  id: 'rfid-ntag', name: 'rfid-ntag', version: '0.1.12', deps: ['u1-base-fm175xx-reader'],
  sources: [
    makeSource({ registryUrl: PUBLISHED_LIST, version: '0.1.12' }),
    makeSource({ registryUrl: OFFLINE_COPY, label: 'bundled (offline copy)', local: true, version: '0.1.14', migration: RFID_TERMS }),
  ],
})

describe('a change of shape declared by the version being sent', () => {
  it('is a migration even when the catalog row it is listed under declares none', () => {
    const migrations = pendingMigrations([], [RFID_FROM_TWO_LISTS, READER], ['rfid-ntag'], { versions: { 'rfid-ntag': '0.1.12' } }, {})
    expect(migrations).toHaveLength(1)
    expect(migrations[0].migratingPluginId).toBe('rfid-ntag')
  })

  it('is an ordinary update when the version being sent is the one that declares nothing', () => {
    const plan = buildUpdatePlan([RFID_FROM_TWO_LISTS, READER], [], ['rfid-ntag'], { versions: { 'rfid-ntag': '0.1.11' }, sources: { 'rfid-ntag': PUBLISHED_LIST } }, {})
    expect(plan.migrations).toEqual([])
    expect(plan.updates.map((spec) => spec.pluginId)).toEqual(['rfid-ntag'])
  })
})

describe('buildUpdatePlan', () => {
  it('carries the ordinary updates and the replacements of one press together', () => {
    const plan = buildUpdatePlan(CATALOG, [MOTION], ['klipper-motion', 'spoolman'], INSTALLED, {})
    expect(plan.updates.map((spec) => spec.pluginId)).toEqual(['spoolman'])
    expect(plan.migrations.map((migration) => migration.migratingPluginId)).toEqual(['klipper-motion'])
  })

  // The retired plugin has no newer version to send: it is coming off. Sending an update for it is
  // what asked the daemon for a package that is not a package any more.
  it('never sends an update for a plugin that is being replaced', () => {
    const plan = buildUpdatePlan(CATALOG, [MOTION], ['klipper-motion', 'spoolman'], INSTALLED, {})
    expect(plan.updates.some((spec) => spec.pluginId === 'klipper-motion')).toBe(false)
  })

  it('counts a replacement as work to do, so Update All offers itself when that is all there is', () => {
    const plan = buildUpdatePlan(CATALOG, [MOTION], ['klipper-motion'], { versions: { 'klipper-motion': '0.1.3' } }, {})
    expect(plan.updates).toEqual([])
    expect(updateAllCount(plan)).toBe(1)
    expect(planIsEmpty(plan)).toBe(false)
  })

  it('has nothing to do on a printer that is already up to date', () => {
    const plan = buildUpdatePlan(CATALOG, [MOTION], ['spoolman'], { versions: { spoolman: '1.0.0' } }, {})
    expect(updateAllCount(plan)).toBe(0)
    expect(planIsEmpty(plan)).toBe(true)
  })
})
