import { describe, it, expect } from 'vitest'
import type { PluginConfigField } from '../types'
import { resolveFieldValue, resolveFormValues, printerVarsView } from './index'

function makeField(overrides: Partial<PluginConfigField> = {}): PluginConfigField {
  return { key: 'SPOOLMAN_SERVER', label: 'Spoolman server', type: 'text', scope: 'global', ...overrides }
}

describe('resolveFieldValue', () => {
  it('prefers the printer-local value over the global one', () => {
    const scopedVars = { SPOOLMAN_SERVER: { global: 'shared:8000', 'local:uuid-a': 'mine:8000' } }
    expect(resolveFieldValue(scopedVars, 'uuid-a', makeField())).toBe('mine:8000')
  })

  it('falls back to the global value when the printer has no override', () => {
    const scopedVars = { SPOOLMAN_SERVER: { global: 'shared:8000', 'local:uuid-a': 'mine:8000' } }
    expect(resolveFieldValue(scopedVars, 'uuid-b', makeField())).toBe('shared:8000')
  })

  it('resolves globally when no printer is in context', () => {
    const scopedVars = { SPOOLMAN_SERVER: { global: 'shared:8000', 'local:uuid-a': 'mine:8000' } }
    expect(resolveFieldValue(scopedVars, undefined, makeField())).toBe('shared:8000')
  })

  it('an empty-string local value shadows global by presence', () => {
    const scopedVars = { SPOOLMAN_LOCATION: { global: 'Workshop', 'local:uuid-a': '' } }
    expect(resolveFieldValue(scopedVars, 'uuid-a', makeField({ key: 'SPOOLMAN_LOCATION' }))).toBe('')
  })

  it('falls back to the manifest default, then the type default', () => {
    expect(resolveFieldValue({}, 'uuid-a', makeField({ default: 'auto' }))).toBe('auto')
    expect(resolveFieldValue({}, 'uuid-a', makeField({ type: 'toggle', offValue: 'off' }))).toBe('off')
    expect(resolveFieldValue({}, 'uuid-a', makeField({ type: 'toggle' }))).toBe('false')
    expect(resolveFieldValue({}, 'uuid-a', makeField({ type: 'select', options: ['error', 'info'] }))).toBe('error')
    expect(resolveFieldValue({}, 'uuid-a', makeField())).toBe('')
  })

  it('a per-printer value never leaks to another printer during seeding', () => {
    const scopedVars = { SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' } }
    const locationField = makeField({ key: 'SPOOLMAN_LOCATION', scope: 'printer', default: '' })
    expect(resolveFieldValue(scopedVars, 'uuid-b', locationField)).toBe('')
  })
})

describe('resolveFormValues', () => {
  it('resolves every field for the printer in one map', () => {
    const scopedVars = {
      SPOOLMAN_SERVER: { global: 'shared:8000' },
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' },
    }
    const fields = [makeField(), makeField({ key: 'SPOOLMAN_LOCATION', scope: 'printer' })]
    expect(resolveFormValues(scopedVars, 'uuid-a', fields)).toEqual({
      SPOOLMAN_SERVER: 'shared:8000',
      SPOOLMAN_LOCATION: 'OG U1',
    })
  })
})

describe('printerVarsView', () => {
  const scopedVars = {
    SPOOLMAN_SERVER: { global: 'shared:8000', 'local:uuid-a': 'mine:8000' },
    SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' },
    SPOOLMAN_MODE: { global: 'auto' },
    NEVER_GLOBAL: { 'local:uuid-b': 'b-only' },
  }

  it('flattens local-over-global for the printer, dropping fields with no value for it', () => {
    expect(printerVarsView(scopedVars, 'uuid-a')).toEqual({
      SPOOLMAN_SERVER: 'mine:8000',
      SPOOLMAN_LOCATION: 'OG U1',
      SPOOLMAN_MODE: 'auto',
    })
  })

  it('second-printer seeding: a per-printer value never appears in another printer\'s view', () => {
    expect(printerVarsView(scopedVars, 'uuid-b')).toEqual({
      SPOOLMAN_SERVER: 'shared:8000',
      SPOOLMAN_MODE: 'auto',
      NEVER_GLOBAL: 'b-only',
    })
  })

  it('with no printer in context only the global slice shows', () => {
    expect(printerVarsView(scopedVars, undefined)).toEqual({
      SPOOLMAN_SERVER: 'shared:8000',
      SPOOLMAN_MODE: 'auto',
    })
  })

  it('an empty-string local value shadows global by presence, exactly like resolution', () => {
    const shadowed = { SPOOLMAN_LOCATION: { global: 'Workshop', 'local:uuid-a': '' } }
    expect(printerVarsView(shadowed, 'uuid-a')).toEqual({ SPOOLMAN_LOCATION: '' })
  })
})
