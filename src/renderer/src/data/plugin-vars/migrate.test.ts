import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  SCHEMA_VERSION_KEY,
  CURRENT_SCHEMA_VERSION,
  PLUGIN_VARS_KEY,
  LEGACY_VARS_KEY,
  migrateFlatVars,
  globalSlice,
  mergeDowngradeEdits,
  persistScopedVars,
  runVarsMigrations,
  type SchemaStorage,
} from './index'
import type { ScopedPluginVars } from './index'

function memoryStorage(seed: Record<string, string> = {}): SchemaStorage & { data: Record<string, string> } {
  const data = { ...seed }

  return {
    data,
    read: (key) => data[key] ?? null,
    write: (key, value) => { data[key] = value },
  }
}

describe('migrateFlatVars', () => {
  it('turns every legacy value into a global-scoped one', () => {
    expect(migrateFlatVars({ SPOOLMAN_SERVER: 'shared:8000', SPOOLMAN_MODE: 'auto' })).toEqual({
      SPOOLMAN_SERVER: { global: 'shared:8000' },
      SPOOLMAN_MODE: { global: 'auto' },
    })
  })

  it('migrates an empty map to an empty store', () => {
    expect(migrateFlatVars({})).toEqual({})
  })
})

describe('runVarsMigrations', () => {
  it('first boot on v2 migrates the legacy map and stamps the schema version', () => {
    const storage = memoryStorage({ [LEGACY_VARS_KEY]: JSON.stringify({ SPOOLMAN_SERVER: 'shared:8000' }) })
    const migrated = runVarsMigrations(storage)
    expect(migrated).toEqual({ SPOOLMAN_SERVER: { global: 'shared:8000' } })
    expect(JSON.parse(storage.data[PLUGIN_VARS_KEY])).toEqual(migrated)
    expect(storage.data[SCHEMA_VERSION_KEY]).toBe(String(CURRENT_SCHEMA_VERSION))
  })

  it('a fresh install with no data at all yields an empty store without throwing', () => {
    expect(runVarsMigrations(memoryStorage())).toEqual({})
  })

  it('is idempotent: a second run changes nothing', () => {
    const storage = memoryStorage({ [LEGACY_VARS_KEY]: JSON.stringify({ SPOOLMAN_SERVER: 'shared:8000' }) })
    const firstRun = runVarsMigrations(storage)
    const snapshotAfterFirst = { ...storage.data }
    const secondRun = runVarsMigrations(storage)
    expect(secondRun).toEqual(firstRun)
    expect(storage.data).toEqual(snapshotAfterFirst)
  })

  it('survives corrupt legacy JSON on first migration', () => {
    const storage = memoryStorage({ [LEGACY_VARS_KEY]: 'not json at all' })
    expect(runVarsMigrations(storage)).toEqual({})
  })
})

describe('runVarsMigrations after a downgrade', () => {
  it('adopts a downgrade edit into the global slice and keeps per-printer entries', () => {
    const scopedBefore: ScopedPluginVars = {
      SPOOLMAN_SERVER: { global: 'old:8000' },
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' },
    }
    const storage = memoryStorage({
      [PLUGIN_VARS_KEY]: JSON.stringify(scopedBefore),
      [SCHEMA_VERSION_KEY]: String(CURRENT_SCHEMA_VERSION),
      [LEGACY_VARS_KEY]: JSON.stringify({ SPOOLMAN_SERVER: 'edited-downgraded:8000' }),
    })
    const reconciled = runVarsMigrations(storage)
    expect(reconciled.SPOOLMAN_SERVER).toEqual({ global: 'edited-downgraded:8000' })
    expect(reconciled.SPOOLMAN_LOCATION).toEqual({ 'local:uuid-a': 'OG U1' })
  })

  it('adopts a field first saved by the older build after a downgrade', () => {
    const storage = memoryStorage({
      [PLUGIN_VARS_KEY]: JSON.stringify({}),
      [SCHEMA_VERSION_KEY]: String(CURRENT_SCHEMA_VERSION),
      [LEGACY_VARS_KEY]: JSON.stringify({ MAINSAIL_PORT: '81' }),
    })
    expect(runVarsMigrations(storage).MAINSAIL_PORT).toEqual({ global: '81' })
  })

  it('a v2 store with a missing schema-version key is reconciled, never clobbered', () => {
    const storage = memoryStorage({
      [PLUGIN_VARS_KEY]: JSON.stringify({ SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' } }),
      [LEGACY_VARS_KEY]: JSON.stringify({}),
    })
    expect(runVarsMigrations(storage).SPOOLMAN_LOCATION).toEqual({ 'local:uuid-a': 'OG U1' })
  })

  it('recovers global values from the legacy mirror when the v2 store is corrupt JSON', () => {
    const storage = memoryStorage({
      [PLUGIN_VARS_KEY]: '{corrupt',
      [SCHEMA_VERSION_KEY]: String(CURRENT_SCHEMA_VERSION),
      [LEGACY_VARS_KEY]: JSON.stringify({ SPOOLMAN_SERVER: 'shared:8000' }),
    })
    expect(runVarsMigrations(storage)).toEqual({ SPOOLMAN_SERVER: { global: 'shared:8000' } })
  })
})

describe('dual-write invariant', () => {
  it('persistScopedVars keeps the legacy key equal to the global slice', () => {
    const storage = memoryStorage()
    const scopedVars: ScopedPluginVars = {
      SPOOLMAN_SERVER: { global: 'shared:8000' },
      SPOOLMAN_LOCATION: { 'local:uuid-a': 'OG U1' },
    }
    persistScopedVars(storage, scopedVars)
    expect(JSON.parse(storage.data[LEGACY_VARS_KEY])).toEqual({ SPOOLMAN_SERVER: 'shared:8000' })
  })
})

const scopedVarsArbitrary = fc.dictionary(
  fc.stringMatching(/^[A-Z][A-Z_]{0,20}$/),
  fc.dictionary(
    fc.oneof(fc.constant('global'), fc.stringMatching(/^local:[a-z0-9-]{1,12}$/)),
    fc.string({ maxLength: 20 }),
    { maxKeys: 4 },
  ),
  { maxKeys: 8 },
)

describe('properties', () => {
  it('after any persist, the legacy mirror is exactly the global slice', () => {
    fc.assert(
      fc.property(scopedVarsArbitrary, (scopedVars) => {
        const storage = memoryStorage()
        persistScopedVars(storage, scopedVars)
        expect(JSON.parse(storage.data[LEGACY_VARS_KEY])).toEqual(globalSlice(scopedVars))
      }),
    )
  })

  it('boot reconciliation is idempotent for any starting storage state', () => {
    fc.assert(
      fc.property(scopedVarsArbitrary, fc.dictionary(fc.stringMatching(/^[A-Z][A-Z_]{0,20}$/), fc.string({ maxLength: 20 })), (scopedVars, legacyFlatVars) => {
        const storage = memoryStorage({
          [PLUGIN_VARS_KEY]: JSON.stringify(scopedVars),
          [LEGACY_VARS_KEY]: JSON.stringify(legacyFlatVars),
        })
        const firstRun = runVarsMigrations(storage)
        expect(runVarsMigrations(storage)).toEqual(firstRun)
      }),
    )
  })

  it('reconciliation never loses a per-printer entry', () => {
    fc.assert(
      fc.property(scopedVarsArbitrary, fc.dictionary(fc.stringMatching(/^[A-Z][A-Z_]{0,20}$/), fc.string({ maxLength: 20 })), (scopedVars, legacyFlatVars) => {
        const reconciled = mergeDowngradeEdits(scopedVars, legacyFlatVars)
        Object.entries(scopedVars).forEach(([fieldKey, fieldScopes]) => {
          Object.entries(fieldScopes)
            .filter(([scopeKey]) => scopeKey !== 'global')
            .forEach(([scopeKey, value]) => expect(reconciled[fieldKey][scopeKey]).toBe(value))
        })
      }),
    )
  })
})
