// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePlugin } from '../../../test/fixtures'
import type { PluginConfigField } from '../../../data/types'
import { PanelConfigArea } from './config-form'

const en = makeT('en')

// SPOOLMAN_MODE carries a default on purpose: the old display would show it (or the app-global
// saved map) for an installed plugin regardless of what the printer runs; the truth ladder must not.
const FIELDS: PluginConfigField[] = [
  { key: 'SPOOLMAN_SERVER', label: 'Server URL', type: 'text', scope: 'global', userEditable: true },
  { key: 'SPOOLMAN_MODE', label: 'Mode', type: 'select', options: ['auto', 'manual'], default: 'auto', scope: 'global', userEditable: true },
]
const PLUGIN = makePlugin({ id: 'spoolman', config: FIELDS })

function installedArea() {
  return (
    <PanelConfigArea
      plugin={PLUGIN} installed printerId="printer-1" otherUiPorts={[]}
      appliedVars={undefined} appliedVarsAt={undefined}
      multiVars={{}} onMultiVars={() => {}} onApplied={() => {}}
    />
  )
}

describe('installed Config tab truth ladder', () => {
  it('tier 1: shows the values the daemon persisted, unbadged', async () => {
    const { container } = setup(installedArea(), {
      b3d: { store: { pluginConfig: vi.fn().mockResolvedValue({ SPOOLMAN_SERVER: 'http://live:8000', SPOOLMAN_MODE: 'manual' }) } },
    })

    expect(await screen.findByRole('button', { name: 'http://live:8000' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'manual' })).toBeInTheDocument()
    expect(container.querySelector('.config-truth-note')).toBeNull()
  })

  it('tier 2: without a live read, shows what this computer sent with the visible as-sent marker', async () => {
    const { container } = setup(
      <PanelConfigArea
        plugin={PLUGIN} installed printerId="printer-1" otherUiPorts={[]}
        appliedVars={{ SPOOLMAN_SERVER: 'http://applied:8000', SPOOLMAN_MODE: 'auto' }} appliedVarsAt="2026-07-01T09:00:00.000Z"
        multiVars={{}} onMultiVars={() => {}} onApplied={() => {}}
      />,
      { b3d: { store: { pluginConfig: vi.fn().mockResolvedValue(null) } } },
    )

    expect(await screen.findByRole('button', { name: 'http://applied:8000' })).toBeInTheDocument()
    expect(container.querySelector('.config-truth-note')?.textContent).toContain('As sent from this computer on')
  })

  it('tier 3 (the truthfulness regression): with nothing to vouch for, every field is explicitly unknown, never a default', async () => {
    // The old code displayed initialConfigValues(fields, savedPluginVars) here: the Mode field would
    // read "auto" (its default) whether or not the printer runs that. The ladder must refuse to guess.
    setup(installedArea(), {
      b3d: { store: { pluginConfig: vi.fn().mockResolvedValue(null) } },
    })

    expect(await screen.findByText(en('store.config_unknown_note'))).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: en('store.config_unknown') })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'auto' })).toBeNull()
  })

  it('seeds the edit draft from the truthful current values, not the app-global map', async () => {
    const { user } = setup(installedArea(), {
      b3d: { store: { pluginConfig: vi.fn().mockResolvedValue({ SPOOLMAN_SERVER: 'http://live:8000', SPOOLMAN_MODE: 'manual' }) } },
    })

    await user.click(await screen.findByRole('button', { name: 'http://live:8000' }))

    expect(screen.getByRole('textbox')).toHaveValue('http://live:8000')
    expect(screen.getByRole('combobox')).toHaveValue('manual')
  })

  it('a same-session apply becomes the freshest last-known state on an old daemon (no live route)', async () => {
    const { user, container, b3d } = setup(installedArea(), {
      b3d: { store: { pluginConfig: vi.fn().mockResolvedValue(null) } },
    })

    const unknownValues = await screen.findAllByRole('button', { name: en('store.config_unknown') })
    await user.click(unknownValues[0])
    await user.type(screen.getByRole('textbox'), 'http://fresh:8000')
    await user.click(screen.getByRole('button', { name: en('store.update_config') }))

    expect(b3d.store.reconfigure).toHaveBeenCalledWith('printer-1', 'spoolman', { SPOOLMAN_SERVER: 'http://fresh:8000', SPOOLMAN_MODE: 'auto' })
    expect(await screen.findByRole('button', { name: 'http://fresh:8000' })).toBeInTheDocument()
    expect(container.querySelector('.config-truth-note')?.textContent).toContain('As sent from this computer on')
  })
})
