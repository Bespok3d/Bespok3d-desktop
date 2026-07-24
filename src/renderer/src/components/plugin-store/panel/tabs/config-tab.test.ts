// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { makePlugin } from '../../../../test/fixtures'
import { saveValuesToScopes, effectiveScope, localScopeKey } from '../../../../data/plugin-vars'
import type { ScopedPluginVars, PluginVarsSave } from '../../../../data/plugin-vars'
import type { PluginConfigField } from '../../../../data/types'
import { usePanelConfigState } from './config-tab'

const LOCATION_FIELD: PluginConfigField = { key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', scope: 'global' }
const SPOOLMAN_PLUGIN = makePlugin({ id: 'spoolman', title: 'Spoolman', config: [LOCATION_FIELD] })
const PRINTER_KEY = 'aaaaaaaa-1111-2222-3333-444444444444'

// One open panel wired exactly as App wires it: scope presets derive from the shared store, and
// every save folds back into it for the printer in context.
function openPanel(sharedStore: { scopedVars: ScopedPluginVars }) {
  function scopeFor(field: PluginConfigField) {
    return effectiveScope(sharedStore.scopedVars, PRINTER_KEY, field)
  }
  function persistSave(save: PluginVarsSave) {
    sharedStore.scopedVars = saveValuesToScopes(sharedStore.scopedVars, PRINTER_KEY, save)
  }

  return renderHook(() => usePanelConfigState({
    plugin: SPOOLMAN_PLUGIN, plugins: [SPOOLMAN_PLUGIN], installed: true, installedIds: ['spoolman'],
    savedVars: {}, printerId: 'printer-1', scopeFor, onSaveVars: persistSave,
  }))
}

describe('usePanelConfigState scope-flip retention', () => {
  it('a flip persists immediately through onSaveVars with the shown value and the explicit choice', () => {
    const onSaveVars = vi.fn()
    const { result } = renderHook(() => usePanelConfigState({
      plugin: SPOOLMAN_PLUGIN, plugins: [SPOOLMAN_PLUGIN], installed: true, installedIds: ['spoolman'],
      savedVars: {}, printerId: 'printer-1', onSaveVars,
    }))

    act(() => result.current.setFieldScope('SPOOLMAN_LOCATION', 'printer', 'Shelf A'))

    expect(onSaveVars).toHaveBeenCalledWith({
      values: { SPOOLMAN_LOCATION: 'Shelf A' },
      fields: [LOCATION_FIELD],
      scopeChoices: { SPOOLMAN_LOCATION: 'printer' },
    })
    expect(result.current.multiScopes.SPOOLMAN_LOCATION).toBe('printer')
  })

  it('a flip WITHOUT a value edit survives a panel close and reopen (the R5 retention regression)', () => {
    const sharedStore = { scopedVars: {} as ScopedPluginVars }
    const firstOpen = openPanel(sharedStore)

    act(() => firstOpen.result.current.setFieldScope('SPOOLMAN_LOCATION', 'printer', 'Shelf A'))
    firstOpen.unmount()

    expect(sharedStore.scopedVars.SPOOLMAN_LOCATION).toEqual({ [localScopeKey(PRINTER_KEY)]: 'Shelf A' })
    const reopened = openPanel(sharedStore)
    expect(reopened.result.current.multiScopes.SPOOLMAN_LOCATION).toBe('printer')
  })

  it('flipping back to All printers clears the override and a reopened panel derives global again', () => {
    const sharedStore = { scopedVars: { SPOOLMAN_LOCATION: { [localScopeKey(PRINTER_KEY)]: 'Shelf A' } } }
    const firstOpen = openPanel(sharedStore)
    expect(firstOpen.result.current.multiScopes.SPOOLMAN_LOCATION).toBe('printer')

    act(() => firstOpen.result.current.setFieldScope('SPOOLMAN_LOCATION', 'global', 'Shelf A'))
    firstOpen.unmount()

    expect(sharedStore.scopedVars.SPOOLMAN_LOCATION).toEqual({ global: 'Shelf A' })
    const reopened = openPanel(sharedStore)
    expect(reopened.result.current.multiScopes.SPOOLMAN_LOCATION).toBe('global')
  })
})
