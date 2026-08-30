// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { makeT } from '../../i18n'
import { makePlugin } from '../../test/fixtures'
import { batchBlockReason, memberBlockReason, splitByBatchGate } from './batch-gate'

const t = makeT('en')

const READER = makePlugin({ id: 'rfid-ntag', name: 'rfid-ntag', title: 'RFID Reader' })
const DECODER = makePlugin({ id: 'rfid-opentag', name: 'rfid-opentag', title: 'OpenTag Decoder' })
const RIVAL = makePlugin({ id: 'rfid-rival', name: 'rfid-rival', title: 'Rival Reader', conflicts: ['rfid-ntag'] })

interface PrinterState { printerId?: string; printActive: boolean; blockedActions: string[] }

const IDLE: PrinterState = { printerId: 'printer-1', printActive: false, blockedActions: [] }
const PRINTING: PrinterState = { printerId: 'printer-1', printActive: true, blockedActions: ['install'] }

function context(state: PrinterState) {
  return { ...state, catalogPlugins: [READER, DECODER, RIVAL], installedIds: ['rfid-ntag'], savedVars: {} }
}

describe('batchBlockReason', () => {
  it('lets a batch run on an idle managed printer', () => {
    expect(batchBlockReason(t, IDLE)).toBeNull()
  })

  it('blocks the whole batch while a print is running', () => {
    expect(batchBlockReason(t, PRINTING)?.brief).toBe(t('store.block.print.brief'))
  })

  it('blocks the whole batch when no printer is selected', () => {
    expect(batchBlockReason(t, { printerId: undefined, printActive: false, blockedActions: [] })?.brief)
      .toBe(t('store.block.no_printer.brief'))
  })
})

describe('splitByBatchGate', () => {
  it('keeps a member a single install would accept', () => {
    expect(splitByBatchGate(t, [DECODER], context(IDLE)).eligible.map((plugin) => plugin.id)).toEqual(['rfid-opentag'])
  })

  it('blocks a member that conflicts with an installed plugin, and keeps the rest', () => {
    const split = splitByBatchGate(t, [DECODER, RIVAL], context(IDLE))

    expect(split.eligible.map((plugin) => plugin.id)).toEqual(['rfid-opentag'])
    expect(split.blocked.map((row) => row.plugin.id)).toEqual(['rfid-rival'])
  })

  it('blocks every member while a print is running', () => {
    const split = splitByBatchGate(t, [DECODER, RIVAL], context(PRINTING))

    expect(split.eligible).toEqual([])
    expect(split.blocked.map((row) => row.block.brief)).toEqual([t('store.block.print.brief'), t('store.block.print.brief')])
  })

  // The batch collects missing required values on BatchConfigModal before it runs, so an unset value is
  // not a block here. Anything else the plugin panel refuses must refuse here too.
  it('does not treat an unset required value as a block, since the batch captures it first', () => {
    const keyed = makePlugin({ id: 'rfid-bambu', name: 'rfid-bambu', title: 'Bambu Decoder', config: [{ key: 'BAMBU_KEY', label: 'Master key', type: 'text', scope: 'global', required: true }] })

    expect(memberBlockReason(t, keyed, { ...context(IDLE), catalogPlugins: [READER, keyed] })).toBeNull()
  })
})

// A plugin whose card is greyed out because this printer runs an older daemon than it declares was
// still offered inside a batch: the printer took the batch and refused that one member on arrival,
// which is a failed install shown after the click instead of an ineligible member shown before it.
describe('a member this printer is too old to run', () => {
  const NEEDS_NEW_DAEMON = makePlugin({ id: 'rfid-opentag', name: 'rfid-opentag', title: 'OpenTag Decoder', minDaemonVersion: '0.11.0' })

  function contextOnDaemon(daemonVersion?: string) {
    return { ...context(IDLE), catalogPlugins: [READER, NEEDS_NEW_DAEMON], daemonVersion }
  }

  it('is left out of the batch, naming the version it needs and the one the printer runs', () => {
    const split = splitByBatchGate(t, [NEEDS_NEW_DAEMON], contextOnDaemon('0.10.31'))

    expect(split.eligible).toEqual([])
    expect(split.blocked.map((row) => row.block.brief)).toEqual([t('store.block.daemon_too_old.brief', { required: '0.11.0', running: '0.10.31' })])
  })

  it('joins the batch once the printer runs a daemon new enough', () => {
    expect(splitByBatchGate(t, [NEEDS_NEW_DAEMON], contextOnDaemon('0.11.4')).eligible.map((plugin) => plugin.id)).toEqual(['rfid-opentag'])
  })

  // The version is what the printer answered. Not having answered yet is not the printer saying no.
  it('is not refused by a printer that has not said what it runs', () => {
    expect(memberBlockReason(t, NEEDS_NEW_DAEMON, contextOnDaemon(undefined))).toBeNull()
  })
})
