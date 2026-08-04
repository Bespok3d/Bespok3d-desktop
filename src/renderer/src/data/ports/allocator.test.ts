// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { assignPort, portConflict, takePort, PRIMARY_PORT } from './allocator'

describe('assignPort', () => {
  it('gives the first UI port 80 (it becomes primary)', () => {
    expect(assignPort([])).toBe(PRIMARY_PORT)
  })

  it('gives the next UI port 81 once 80 is taken', () => {
    expect(assignPort([80])).toBe(81)
  })

  it('fills the next free port in sequence', () => {
    expect(assignPort([80, 81, 82])).toBe(83)
  })

  it('never assigns a reserved port', () => {
    expect(assignPort([7125])).toBe(PRIMARY_PORT)
  })
})

describe('taking port 80', () => {
  it('swaps the new primary onto 80 and reflows the displaced UI to 81', () => {
    expect(takePort({ fluidd: 80, mainsail: 81 }, 'mainsail', PRIMARY_PORT)).toEqual({
      fluidd: 81,
      mainsail: 80,
    })
  })

  it('is a no-op when the target already holds 80', () => {
    expect(takePort({ fluidd: 80 }, 'fluidd', PRIMARY_PORT)).toEqual({ fluidd: 80 })
  })

  it('reflows the displaced UI past every occupied port', () => {
    expect(takePort({ fluidd: 80, mainsail: 81, foo: 82 }, 'foo', PRIMARY_PORT)).toEqual({
      foo: 80,
      mainsail: 81,
      fluidd: 82,
    })
  })
})

describe('takePort', () => {
  it('moves the UI that holds the claimed port to the next free port', () => {
    expect(takePort({ fluidd: 80, mainsail: 81 }, 'mainsail', 80)).toEqual({ mainsail: 80, fluidd: 81 })
  })

  it('leaves every other UI where it is', () => {
    expect(takePort({ fluidd: 80, mainsail: 81, octoeverywhere: 82 }, 'mainsail', 80)).toEqual({
      mainsail: 80,
      fluidd: 81,
      octoeverywhere: 82,
    })
  })

  it('sends the displaced UI past the ports the others still hold', () => {
    expect(takePort({ fluidd: 80, mainsail: 81, other: 82 }, 'other', 80)).toEqual({
      other: 80,
      fluidd: 82,
      mainsail: 81,
    })
  })

  it('just takes a free port, moving nobody', () => {
    expect(takePort({ fluidd: 80 }, 'mainsail', 81)).toEqual({ fluidd: 80, mainsail: 81 })
  })
})

describe('portConflict', () => {
  it('rejects a port below 80', () => {
    expect(portConflict(79)).toEqual({ key: 'store.port_too_low', params: { min: 80 } })
  })

  it('rejects a port the printer itself keeps', () => {
    expect(portConflict(7125)).toEqual({ key: 'store.port_reserved', params: { port: 7125 } })
  })

  it('accepts a port another web UI holds, because that UI is moved instead of the user being stuck', () => {
    expect(portConflict(80)).toBeNull()
    expect(portConflict(81)).toBeNull()
  })
})
