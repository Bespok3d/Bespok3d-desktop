// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { remapPrinterScope, printerKeyFor, printerVarsView, saveValuesToScopes } from './index'
import type { ScopedPluginVars } from './index'
import type { PluginConfigField } from '../plugin-config'

const LOCATION_FIELD: PluginConfigField = {
  key: 'SPOOLMAN_LOCATION',
  label: 'Location',
  type: 'text',
  scope: 'printer',
}

describe('remapPrinterScope', () => {
  it('moves every field entry off the printer UUID and onto the app record id', () => {
    const scopedVars = {
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' },
      SPOOLMAN_SERVER: { global: 'shared:8000', 'local:uuid-a': 'mine:8000' },
    }
    expect(remapPrinterScope(scopedVars, 'p-1719900000000', 'uuid-a')).toEqual({
      SPOOLMAN_LOCATION: { 'local:p-1719900000000': 'OG U1' },
      SPOOLMAN_SERVER: { global: 'shared:8000', 'local:p-1719900000000': 'mine:8000' },
    })
  })

  it('an existing record-id entry wins a collision (it is the one this build writes)', () => {
    const scopedVars = { SPOOLMAN_LOCATION: { 'local:uuid-a': 'stale name', 'local:p-1': 'OG U1' } }
    expect(remapPrinterScope(scopedVars, 'p-1', 'uuid-a')).toEqual({
      SPOOLMAN_LOCATION: { 'local:p-1': 'OG U1' },
    })
  })

  it('leaves other printers, global, and future group scopes untouched', () => {
    const scopedVars = {
      SPOOLMAN_LOCATION: { 'local:uuid-other': 'U1 Junior', global: 'Workshop', 'group:garage': 'Garage' },
    }
    expect(remapPrinterScope(scopedVars, 'p-1', 'uuid-a')).toEqual(scopedVars)
  })

  it('is a no-op when the UUID never held anything', () => {
    expect(remapPrinterScope({}, 'p-1', 'uuid-a')).toEqual({})
  })

  it('returns the INPUT REFERENCE when nothing moves, so a re-running App effect converges', () => {
    const scopedVars = {
      SPOOLMAN_LOCATION: { 'local:p-1': 'OG U1', global: 'Workshop' },
      SPOOLMAN_SERVER: { global: 'shared:8000' },
    }
    expect(remapPrinterScope(scopedVars, 'p-1', 'uuid-a')).toBe(scopedVars)
    const onceRemapped = remapPrinterScope({ FIELD: { 'local:uuid-a': 'moved' } }, 'p-1', 'uuid-a')
    expect(remapPrinterScope(onceRemapped, 'p-1', 'uuid-a')).toBe(onceRemapped)
  })
})

// R-4: a reflash, a /userdata wipe or a daemon reinstall mints a fresh printer UUID. The value the
// user saved for that printer must still be there afterwards, which is what these assert: the SAVED
// VALUE read back through the printer's flat view, not the shape of a storage key.
describe('per-printer settings survive a new printer UUID', () => {
  it('reads back the saved value after the printer reports a different UUID', () => {
    const beforeReflash = { id: 'p-1', printerUuid: 'uuid-first' }
    const saved = saveValuesToScopes({}, printerKeyFor(beforeReflash), {
      values: { SPOOLMAN_LOCATION: 'Shelf A' },
      fields: [LOCATION_FIELD],
    })
    const afterReflash = { id: 'p-1', printerUuid: 'uuid-second' }
    const carriedOver = remapPrinterScope(saved, afterReflash.id, afterReflash.printerUuid)

    expect(printerVarsView(carriedOver, printerKeyFor(afterReflash)).SPOOLMAN_LOCATION).toBe('Shelf A')
  })

  it('keeps two printers on separate values across the carry-over', () => {
    const workshop = { id: 'p-1', printerUuid: 'uuid-workshop' }
    const office = { id: 'p-2', printerUuid: 'uuid-office' }
    const storedUnderOldUuids = {
      SPOOLMAN_LOCATION: { 'local:uuid-workshop': 'Shelf A', 'local:uuid-office': 'Shelf B' },
    }
    const carriedOver = [workshop, office].reduce<ScopedPluginVars>(
      (vars, printer) => remapPrinterScope(vars, printer.id, printer.printerUuid),
      storedUnderOldUuids,
    )

    expect(printerVarsView(carriedOver, printerKeyFor(workshop)).SPOOLMAN_LOCATION).toBe('Shelf A')
    expect(printerVarsView(carriedOver, printerKeyFor(office)).SPOOLMAN_LOCATION).toBe('Shelf B')
  })

  it('carries a UUID-keyed value written by an older build onto the record id now read', () => {
    const printer = { id: 'p-1', printerUuid: 'uuid-a' }
    const storedByOlderBuild = { SPOOLMAN_LOCATION: { 'local:uuid-a': 'Shelf A' } }

    expect(printerVarsView(storedByOlderBuild, printerKeyFor(printer)).SPOOLMAN_LOCATION).toBeUndefined()
    const carriedOver = remapPrinterScope(storedByOlderBuild, printer.id, printer.printerUuid)

    expect(printerVarsView(carriedOver, printerKeyFor(printer)).SPOOLMAN_LOCATION).toBe('Shelf A')
  })
})
