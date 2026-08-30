// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { migrationOffer, migrationNoticeShows } from './offer'
import { installedOnPrinter } from '../../data/channels/updates'
import { makeCollection, makePlugin, makePrinter } from '../../test/fixtures'

// klipper-motion as it actually is: a plugin through 0.1.3, a collection of the base-layer plugins
// from 0.1.4 on. The arriving plugins are the ones that need the newer daemon.
const TOOLHEAD = makePlugin({ id: 'u1-base-toolhead', name: 'u1-base-toolhead', title: 'Toolhead', version: '0.1.0', minDaemonVersion: '0.13.0' })
const SHAPER = makePlugin({ id: 'u1-base-shaper-calibrate', name: 'u1-base-shaper-calibrate', title: 'Shaper Calibrate', version: '0.1.0', minDaemonVersion: '0.14.0' })
const CATALOG = [TOOLHEAD, SHAPER]

const MOTION = makeCollection({
  id: 'klipper-motion', name: 'klipper-motion', title: 'Smoother Motion', version: '0.1.4',
  description: 'Motion tuning for the U1.',
  members: [{ id: 'u1-base-toolhead' }, { id: 'u1-base-shaper-calibrate' }],
})

function junior(overrides = {}) {
  return makePrinter({ status: 'managed', installedIds: ['klipper-motion'], installedVersions: { 'klipper-motion': '0.1.3' }, daemonVersion: '0.14.3', ...overrides })
}

// What the printer answered it has installed is what the change is measured against, exactly as the
// app reads it: the offer is the same call with that reading passed in.
type OfferArgs = Parameters<typeof migrationOffer>
function offerFor(printer: NonNullable<OfferArgs[0]>, collections: OfferArgs[1], plugins: OfferArgs[2]) {
  return migrationOffer(printer, collections, plugins, installedOnPrinter(printer), {})
}

describe('migrationOffer', () => {
  it('names the plugin that is going and the plugins that take over its job', () => {
    const offer = offerFor(junior(), [MOTION], CATALOG)
    expect(offer?.migratingName).toBe('Smoother Motion')
    expect(offer?.arrivingNames).toEqual(['Toolhead', 'Shaper Calibrate'])
  })

  it('reads the explanation the publisher wrote for the move, not the collection blurb', () => {
    const declared = { ...MOTION, migration: { summary: 'The base layer owns the patching now.' } }
    expect(offerFor(junior(), [declared], CATALOG)?.summary).toBe('The base layer owns the patching now.')
  })

  it('falls back to what the collection says about itself when no explanation was written', () => {
    expect(offerFor(junior(), [MOTION], CATALOG)?.summary).toBe('Motion tuning for the U1.')
  })

  it('asks for the daemon the publisher declared for the move', () => {
    const declared = { ...MOTION, migration: { summary: 'x', requiresDaemon: '0.15.0' } }
    const offer = offerFor(junior(), [declared], CATALOG)
    expect(offer?.requiredDaemon).toBe('0.15.0')
    expect(offer?.daemonReady).toBe(false)
  })

  // Nobody wrote a floor down, so the move needs whatever the highest arriving plugin needs: sending
  // them to a daemon that cannot run them is how a printer ends up half moved.
  it('asks for the newest daemon any arriving plugin needs when none was declared', () => {
    expect(offerFor(junior(), [MOTION], CATALOG)?.requiredDaemon).toBe('0.14.0')
  })

  it('holds the move back while the printer is on an older daemon', () => {
    expect(offerFor(junior({ daemonVersion: '0.12.25' }), [MOTION], CATALOG)?.daemonReady).toBe(false)
  })

  it('lets the move go once the printer is on a daemon new enough for it', () => {
    expect(offerFor(junior(), [MOTION], CATALOG)?.daemonReady).toBe(true)
  })

  // The declared terms say which installed copies the move was written for. A printer left further
  // back than that is not swept into a move nobody wrote for it.
  it('leaves a printer alone when its installed copy is older than the terms of the move', () => {
    const declared = { ...MOTION, migration: { summary: 'x', fromVersion: '0.1.3' } }
    const older = junior({ installedVersions: { 'klipper-motion': '0.1.2' } })
    expect(offerFor(older, [declared], CATALOG)).toBeNull()
    expect(offerFor(junior(), [declared], CATALOG)).not.toBeNull()
  })

  it('has nothing to offer a printer carrying no retired plugin', () => {
    expect(offerFor(junior({ installedIds: [], installedVersions: {} }), [MOTION], CATALOG)).toBeNull()
  })
})

describe('migrationNoticeShows', () => {
  // A printer with plugins on it reads as `managed`, which is every printer a takeover can apply to.
  it('offers the move on a printer that is well', () => {
    expect(migrationNoticeShows(junior())).toBe(true)
  })

  it('offers the move on a reachable printer with nothing else installed', () => {
    expect(migrationNoticeShows(junior({ status: 'online' }))).toBe(true)
  })

  it('waits behind a printer that is offline', () => {
    expect(migrationNoticeShows(junior({ status: 'offline' }))).toBe(false)
  })

  it('waits behind a printer that is switched off in the app', () => {
    expect(migrationNoticeShows(junior({ status: 'deactivated' }))).toBe(false)
  })

  it('waits behind a printer asking to be repaired', () => {
    const broken = junior({ status: 'online', connection: { reach: 'recoverable', sshOpen: true }, enrollmentLog: { enrolledAt: '2026-06-16T22:03:00Z', adapterId: 'snapmaker-u1', steps: [] } })
    expect(migrationNoticeShows(broken)).toBe(false)
  })
})

// rfid-ntag keeps its id: it stays on the printer and starts working differently, bringing the
// base-layer plugin that now holds the files it used to patch itself.
const RFID_READER = makePlugin({ id: 'u1-base-fm175xx-reader', name: 'u1-base-fm175xx-reader', title: 'Card Reader', version: '0.1.0' })
const RFID = makePlugin({
  id: 'rfid-ntag', name: 'rfid-ntag', title: 'RFID Spool Reader', version: '0.1.14',
  deps: ['u1-base-fm175xx-reader'],
  migration: { summary: 'The base layer holds those files now.', untilVersion: '0.1.14', requiresDaemon: '0.14.2' },
})

function rfidPrinter(overrides = {}) {
  return makePrinter({ status: 'managed', installedIds: ['rfid-ntag'], installedVersions: { 'rfid-ntag': '0.1.12' }, daemonVersion: '0.14.3', ...overrides })
}

describe('a plugin that changes without leaving the printer', () => {
  it('is offered as itself, with what it brings with it', () => {
    const offer = offerFor(rfidPrinter(), [], [RFID, RFID_READER])
    expect(offer?.migratingName).toBe('RFID Spool Reader')
    expect(offer?.comingOffThePrinter).toBe(false)
    expect(offer?.arrivingNames).toEqual(['Card Reader'])
  })

  it('reads the explanation the publisher wrote for the change', () => {
    expect(offerFor(rfidPrinter(), [], [RFID, RFID_READER])?.summary).toBe('The base layer holds those files now.')
  })

  it('waits for the Bespok3d service the change needs before offering it', () => {
    expect(offerFor(rfidPrinter({ daemonVersion: '0.14.1' }), [], [RFID, RFID_READER])?.daemonReady).toBe(false)
    expect(offerFor(rfidPrinter(), [], [RFID, RFID_READER])?.daemonReady).toBe(true)
  })

  it('offers nothing to a printer that has already made the change', () => {
    expect(offerFor(rfidPrinter({ installedVersions: { 'rfid-ntag': '0.1.14' } }), [], [RFID, RFID_READER])).toBeNull()
  })
})
