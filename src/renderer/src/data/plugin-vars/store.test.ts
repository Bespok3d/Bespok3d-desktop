// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { PluginConfigField } from '../types'
import { withExplicitScope } from '../plugin-config'
import { saveFieldValue, clearFieldScope, clearAllPrinterScopes, effectiveScope, fieldIsPrinterScoped, saveValuesToScopes } from './index'
import { GLOBAL_SCOPE, localScopeKey } from './index'

function makeField(overrides: Partial<PluginConfigField> = {}): PluginConfigField {
  return { key: 'SPOOLMAN_SERVER', label: 'Spoolman server', type: 'text', scope: 'global', ...overrides }
}

describe('saveFieldValue', () => {
  it('writes into the given scope without touching other scopes or fields', () => {
    const scopedVars = {
      SPOOLMAN_SERVER: { global: 'shared:8000' },
      SPOOLMAN_MODE: { global: 'auto' },
    }
    const saved = saveFieldValue(scopedVars, localScopeKey('uuid-a'), 'SPOOLMAN_SERVER', 'mine:8000')
    expect(saved.SPOOLMAN_SERVER).toEqual({ global: 'shared:8000', 'local:uuid-a': 'mine:8000' })
    expect(saved.SPOOLMAN_MODE).toEqual({ global: 'auto' })
  })

  it('does not mutate its input', () => {
    const scopedVars = { SPOOLMAN_SERVER: { global: 'shared:8000' } }
    saveFieldValue(scopedVars, GLOBAL_SCOPE, 'SPOOLMAN_SERVER', 'changed:8000')
    expect(scopedVars.SPOOLMAN_SERVER.global).toBe('shared:8000')
  })
})

describe('clearFieldScope', () => {
  it('removes only the given scope, keeping others including future group scopes', () => {
    const scopedVars = {
      SPOOLMAN_LOCATION: { global: 'Workshop', 'local:uuid-a': 'OG U1', 'group:garage': 'Garage' },
    }
    const cleared = clearFieldScope(scopedVars, localScopeKey('uuid-a'), 'SPOOLMAN_LOCATION')
    expect(cleared.SPOOLMAN_LOCATION).toEqual({ global: 'Workshop', 'group:garage': 'Garage' })
  })

  it('is a safe no-op for an unknown field', () => {
    expect(clearFieldScope({}, GLOBAL_SCOPE, 'NEVER_SAVED').NEVER_SAVED).toEqual({})
  })
})

describe('effectiveScope', () => {
  it('derives "printer" from an existing per-printer entry regardless of the hint', () => {
    const scopedVars = { SPOOLMAN_SERVER: { global: 'shared:8000', 'local:uuid-a': 'mine:8000' } }
    expect(effectiveScope(scopedVars, 'uuid-a', makeField({ scope: 'global' }))).toBe('printer')
  })

  it('follows the manifest hint when no entry decides', () => {
    expect(effectiveScope({}, 'uuid-a', makeField({ scope: 'printer' }))).toBe('printer')
    expect(effectiveScope({}, 'uuid-a', makeField({ scope: 'global' }))).toBe('global')
  })

  it('a legacy wire field (no scope key) is stamped global at the boundary before reaching here', () => {
    expect(withExplicitScope({ key: 'SPOOLMAN_SERVER', label: 'Spoolman server', type: 'text' })).toEqual(makeField())
    expect(withExplicitScope(makeField({ scope: 'printer' })).scope).toBe('printer')
  })

  it('another printer\'s entry does not flip this printer\'s scope', () => {
    const scopedVars = { SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' } }
    expect(effectiveScope(scopedVars, 'uuid-b', makeField({ key: 'SPOOLMAN_LOCATION' }))).toBe('global')
  })
})

const serverField = makeField()
const locationField = makeField({ key: 'SPOOLMAN_LOCATION', scope: 'printer' })

describe('saveValuesToScopes', () => {
  it('lands each value in its hint scope when the UI made no explicit choice', () => {
    const saved = saveValuesToScopes({}, 'uuid-a', {
      values: { SPOOLMAN_SERVER: 'shared:8000', SPOOLMAN_LOCATION: 'OG U1' },
      fields: [serverField, locationField],
    })
    expect(saved).toEqual({
      SPOOLMAN_SERVER: { global: 'shared:8000' },
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' },
    })
  })

  it('an explicit scope choice overrides the hint', () => {
    const saved = saveValuesToScopes({}, 'uuid-a', {
      values: { SPOOLMAN_SERVER: 'mine:8000' },
      fields: [serverField],
      scopeChoices: { SPOOLMAN_SERVER: 'printer' },
    })
    expect(saved).toEqual({ SPOOLMAN_SERVER: { 'local:uuid-a': 'mine:8000' } })
  })

  it('an existing per-printer entry keeps the field on this printer (derived scope)', () => {
    const scopedVars = { SPOOLMAN_SERVER: { global: 'shared:8000', 'local:uuid-a': 'old:8000' } }
    const saved = saveValuesToScopes(scopedVars, 'uuid-a', {
      values: { SPOOLMAN_SERVER: 'new:8000' },
      fields: [serverField],
    })
    expect(saved.SPOOLMAN_SERVER).toEqual({ global: 'shared:8000', 'local:uuid-a': 'new:8000' })
  })
})

describe('saveValuesToScopes scope flips and cross-printer isolation', () => {
  it('flipping a field back to global clears this printer\'s override so it stops shadowing', () => {
    const scopedVars = { SPOOLMAN_SERVER: { global: 'shared:8000', 'local:uuid-a': 'mine:8000' } }
    const saved = saveValuesToScopes(scopedVars, 'uuid-a', {
      values: { SPOOLMAN_SERVER: 'everyone:8000' },
      fields: [serverField],
      scopeChoices: { SPOOLMAN_SERVER: 'global' },
    })
    expect(saved.SPOOLMAN_SERVER).toEqual({ global: 'everyone:8000' })
  })

  it('with no printer in context every value lands global, even printer-hinted ones', () => {
    const saved = saveValuesToScopes({}, undefined, {
      values: { SPOOLMAN_LOCATION: 'Workshop' },
      fields: [locationField],
    })
    expect(saved).toEqual({ SPOOLMAN_LOCATION: { global: 'Workshop' } })
  })

  it('ignores fields the save carries no value for, and values with no field def', () => {
    const saved = saveValuesToScopes({}, 'uuid-a', {
      values: { UNRELATED: 'x' },
      fields: [serverField],
    })
    expect(saved).toEqual({})
  })

  it('update-all clobber regression: saving for printer A leaves printer B\'s value intact', () => {
    const scopedVars = {
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1', 'local:uuid-b': 'U1 Junior' },
    }
    const saved = saveValuesToScopes(scopedVars, 'uuid-a', {
      values: { SPOOLMAN_LOCATION: 'OG U1 shelf 2' },
      fields: [locationField],
    })
    expect(saved.SPOOLMAN_LOCATION).toEqual({ 'local:uuid-a': 'OG U1 shelf 2', 'local:uuid-b': 'U1 Junior' })
  })
})

describe('fieldIsPrinterScoped (no mixed scopes: one printer\'s own value scopes the field for all)', () => {
  it('classifies a manifest-hinted field per-printer regardless of store contents', () => {
    expect(fieldIsPrinterScoped({}, makeField({ scope: 'printer' }))).toBe(true)
  })

  it('classifies a global-hinted field per-printer as soon as ANY printer holds its own value', () => {
    const scopedVars = { SPOOLMAN_SERVER: { [GLOBAL_SCOPE]: 'http://spoolman.example:7912', [localScopeKey('uuid-b')]: 'http://office.example:7912' } }
    expect(fieldIsPrinterScoped(scopedVars, makeField())).toBe(true)
  })

  it('keeps a global-hinted field shared while only the global slice holds it', () => {
    const scopedVars = { SPOOLMAN_SERVER: { [GLOBAL_SCOPE]: 'http://spoolman.example:7912' } }
    expect(fieldIsPrinterScoped(scopedVars, makeField())).toBe(false)
  })
})

describe('clearAllPrinterScopes (variable-level flip back to shared)', () => {
  it('drops every printer\'s own value and keeps the global slice', () => {
    const scopedVars = {
      SPOOLMAN_SERVER: {
        [GLOBAL_SCOPE]: 'http://spoolman.example:7912',
        [localScopeKey('uuid-a')]: 'http://workshop.example:7912',
        [localScopeKey('uuid-b')]: 'http://office.example:7912',
      },
    }
    const cleared = clearAllPrinterScopes(scopedVars, 'SPOOLMAN_SERVER')
    expect(cleared.SPOOLMAN_SERVER).toEqual({ [GLOBAL_SCOPE]: 'http://spoolman.example:7912' })
    expect(fieldIsPrinterScoped(cleared, makeField())).toBe(false)
  })

  it('leaves other fields untouched', () => {
    const scopedVars = {
      SPOOLMAN_SERVER: { [localScopeKey('uuid-a')]: 'http://workshop.example:7912' },
      SPOOLMAN_LOCATION: { [localScopeKey('uuid-a')]: 'Shelf A' },
    }
    expect(clearAllPrinterScopes(scopedVars, 'SPOOLMAN_SERVER').SPOOLMAN_LOCATION).toEqual({ [localScopeKey('uuid-a')]: 'Shelf A' })
  })
})
