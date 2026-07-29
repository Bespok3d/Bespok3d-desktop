// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { jinniLags, updateCallout, pendingUpdates } from './updates'
import { makePrinter } from '../../test/fixtures'

describe('jinniLags', () => {
  it('lags when the device version differs from the bundled one', () => {
    expect(jinniLags('0.1.5', '0.1.6')).toBe(true)
  })

  it('does not lag when the versions match', () => {
    expect(jinniLags('0.1.6', '0.1.6')).toBe(false)
  })

  it('never proposes a downgrade when the device jinni is newer than the bundled one', () => {
    expect(jinniLags('0.1.7', '0.1.6')).toBe(false)
  })

  it('never lags on an unknown or missing device version (daemon too old to report it)', () => {
    expect(jinniLags('unknown', '0.1.6')).toBe(false)
    expect(jinniLags(undefined, '0.1.6')).toBe(false)
  })
})

describe('updateCallout', () => {
  it('offers a combined update when both the daemon and the jinni lag (daemon update covers both)', () => {
    expect(updateCallout(makePrinter({ status: 'managed', daemonUpdateAvailable: true, jinniVersion: '0.1.5' }), '0.1.6')).toBe('both')
  })

  it('offers a daemon update when only the daemon lags', () => {
    expect(updateCallout(makePrinter({ status: 'managed', daemonUpdateAvailable: true, jinniVersion: '0.1.6' }), '0.1.6')).toBe('daemon')
  })

  it('offers a jinni update only when the daemon is current and the jinni lags', () => {
    expect(updateCallout(makePrinter({ status: 'managed', jinniVersion: '0.1.5' }), '0.1.6')).toBe('jinni')
  })

  it('offers nothing when both the daemon and the jinni are current', () => {
    expect(updateCallout(makePrinter({ status: 'managed', jinniVersion: '0.1.6' }), '0.1.6')).toBeNull()
  })

  it('offers nothing when the app does not know the adapter jinni version yet', () => {
    expect(updateCallout(makePrinter({ status: 'managed', jinniVersion: '0.1.5' }), undefined)).toBeNull()
  })

  it('never offers a jinni update when the device reports an unknown jinni version', () => {
    expect(updateCallout(makePrinter({ status: 'managed', jinniVersion: 'unknown' }), '0.1.6')).toBeNull()
  })

  it('offers nothing for a printer that is not managed, even when versions lag (offline cannot update)', () => {
    expect(updateCallout(makePrinter({ status: 'offline', daemonUpdateAvailable: true, jinniVersion: '0.1.5' }), '0.1.6')).toBeNull()
    expect(pendingUpdates(makePrinter({ status: 'offline', daemonUpdateAvailable: true, jinniVersion: '0.1.5' }), '0.1.6')).toEqual({ daemon: false, jinni: false })
  })
})
