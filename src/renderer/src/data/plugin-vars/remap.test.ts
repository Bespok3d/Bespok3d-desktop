// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { remapPrinterScope } from './index'

describe('remapPrinterScope', () => {
  it('moves every field entry from the app record id onto the printer UUID', () => {
    const scopedVars = {
      SPOOLMAN_LOCATION: { 'local:p-1719900000000': 'OG U1' },
      SPOOLMAN_SERVER: { global: 'shared:8000', 'local:p-1719900000000': 'mine:8000' },
    }
    expect(remapPrinterScope(scopedVars, 'p-1719900000000', 'uuid-a')).toEqual({
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' },
      SPOOLMAN_SERVER: { global: 'shared:8000', 'local:uuid-a': 'mine:8000' },
    })
  })

  it('an existing UUID entry wins a collision (it is the newer intent)', () => {
    const scopedVars = { SPOOLMAN_LOCATION: { 'local:p-1': 'stale name', 'local:uuid-a': 'OG U1' } }
    expect(remapPrinterScope(scopedVars, 'p-1', 'uuid-a')).toEqual({
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' },
    })
  })

  it('leaves other printers, global, and future group scopes untouched', () => {
    const scopedVars = {
      SPOOLMAN_LOCATION: { 'local:p-other': 'U1 Junior', global: 'Workshop', 'group:garage': 'Garage' },
    }
    expect(remapPrinterScope(scopedVars, 'p-1', 'uuid-a')).toEqual(scopedVars)
  })

  it('is a no-op when the record id never saved anything', () => {
    expect(remapPrinterScope({}, 'p-1', 'uuid-a')).toEqual({})
  })

  it('returns the INPUT REFERENCE when nothing moves, so a re-running App effect converges', () => {
    const scopedVars = {
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1', global: 'Workshop' },
      SPOOLMAN_SERVER: { global: 'shared:8000' },
    }
    expect(remapPrinterScope(scopedVars, 'p-1', 'uuid-a')).toBe(scopedVars)
    const onceRemapped = remapPrinterScope({ FIELD: { 'local:p-1': 'moved' } }, 'p-1', 'uuid-a')
    expect(remapPrinterScope(onceRemapped, 'p-1', 'uuid-a')).toBe(onceRemapped)
  })
})
