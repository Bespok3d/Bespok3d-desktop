// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { packageFloorRefusal, packageJinniFloorRefusal, pairRefusal } from './floors'

describe('packageFloorRefusal', () => {
  it('names the side to update and the version to reach', () => {
    const refusal = packageFloorRefusal('spoolman', '0.12.22', '0.12.19')

    expect(refusal).toContain('spoolman')
    expect(refusal).toContain('0.12.22')
    expect(refusal).toContain('0.12.19')
    expect(refusal).toContain('Update the daemon on this printer')
  })

  it('says nothing when the daemon clears the floor', () => {
    expect(packageFloorRefusal('spoolman', '0.12.22', '0.12.22')).toBeNull()
    expect(packageFloorRefusal('spoolman', '0.12.22', '0.13.0')).toBeNull()
  })

  it('says nothing when the package declares no floor', () => {
    expect(packageFloorRefusal('spoolman', null, '0.1.0')).toBeNull()
  })

  it('says nothing when the daemon version could not be read', () => {
    expect(packageFloorRefusal('spoolman', '0.12.22', null)).toBeNull()
  })
})

describe('packageJinniFloorRefusal', () => {
  it('names the side to update and the version to reach', () => {
    const refusal = packageJinniFloorRefusal('bespok3d-daemon', '0.1.10', '0.1.9')

    expect(refusal).toContain('bespok3d-daemon')
    expect(refusal).toContain('0.1.10')
    expect(refusal).toContain('0.1.9')
    expect(refusal).toContain('Update the printer support package')
  })

  it('says nothing when the support package clears the floor', () => {
    expect(packageJinniFloorRefusal('bespok3d-daemon', '0.1.10', '0.1.10')).toBeNull()
    expect(packageJinniFloorRefusal('bespok3d-daemon', '0.1.10', '0.2.0')).toBeNull()
  })

  it('says nothing when the package declares no support-package floor', () => {
    expect(packageJinniFloorRefusal('spoolman', null, '0.1.9')).toBeNull()
  })

  it('says nothing when the support-package version could not be read', () => {
    expect(packageJinniFloorRefusal('bespok3d-daemon', '0.1.10', null)).toBeNull()
    expect(packageJinniFloorRefusal('bespok3d-daemon', '0.1.10', 'unknown')).toBeNull()
  })
})

describe('pairRefusal', () => {
  const BOTH_FLOORS = { minDaemonVersion: '0.12.22', minJinniVersion: '0.1.10' }

  it('tells the owner to move the daemon when the daemon is the old half', () => {
    const refusal = pairRefusal({ daemonVersion: '0.12.19', jinniVersion: '0.1.11' }, BOTH_FLOORS)

    expect(refusal).toContain('0.12.22')
    expect(refusal).toContain('0.12.19')
    expect(refusal).toContain('Update the daemon on this printer')
    expect(refusal).not.toContain('Update the printer support package')
  })

  it('tells the owner to move the support package when that is the old half', () => {
    const refusal = pairRefusal({ daemonVersion: '0.12.23', jinniVersion: '0.1.7' }, BOTH_FLOORS)

    expect(refusal).toContain('0.1.10')
    expect(refusal).toContain('0.1.7')
    expect(refusal).toContain('Update the printer support package')
    expect(refusal).not.toContain('Update the daemon on this printer')
  })

  it('passes a pair where each half clears the other floor', () => {
    expect(pairRefusal({ daemonVersion: '0.12.23', jinniVersion: '0.1.11' }, BOTH_FLOORS)).toBeNull()
  })

  it('does not refuse a jinni that reports no version at all', () => {
    expect(pairRefusal({ daemonVersion: '0.12.23', jinniVersion: null }, BOTH_FLOORS)).toBeNull()
    expect(pairRefusal({ daemonVersion: '0.12.23', jinniVersion: 'unknown' }, BOTH_FLOORS)).toBeNull()
  })

  it('does not refuse against a daemon that declares no jinni floor', () => {
    const olderDaemonNoFloor = { minDaemonVersion: null, minJinniVersion: null }

    expect(pairRefusal({ daemonVersion: '0.12.19', jinniVersion: '0.1.2' }, olderDaemonNoFloor)).toBeNull()
  })
})
