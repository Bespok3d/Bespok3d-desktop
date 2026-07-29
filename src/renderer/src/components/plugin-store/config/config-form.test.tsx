// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import type { PluginConfigField } from '../../../data/types'
import { PluginConfigSection } from './config-form'

const en = makeT('en')

const textField: PluginConfigField = { key: 'SPOOLMAN_SERVER', label: 'Server URL', type: 'text', scope: 'global', userEditable: true }
const portField: PluginConfigField = { key: 'PORT', label: 'Port', type: 'http-port', scope: 'global', userEditable: true }

// Open the server-url field, change it to http://new, and press Update config.
async function editServerAndUpdate(user: ReturnType<typeof setup>['user']): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'http://old' }))
  await user.clear(screen.getByRole('textbox'))
  await user.type(screen.getByRole('textbox'), 'http://new')
  await user.click(screen.getByRole('button', { name: en('store.update_config') }))
}

describe('PluginConfigSection reconfigure', () => {
  it('reconfigures an installed plugin with the edited value', async () => {
    var { user, b3d } = setup(
      <PluginConfigSection fields={[textField]} current={{ SPOOLMAN_SERVER: 'http://old' }} installed printerId="printer-1" pluginId="spoolman" />,
    )

    await editServerAndUpdate(user)

    expect(b3d.store.reconfigure).toHaveBeenCalledWith('printer-1', 'spoolman', { SPOOLMAN_SERVER: 'http://new' })
  })

  it('surfaces a failed reconfigure instead of swallowing it', async () => {
    var { user, container } = setup(
      <PluginConfigSection fields={[textField]} current={{ SPOOLMAN_SERVER: 'http://old' }} installed printerId="printer-1" pluginId="spoolman" />,
      { b3d: { store: { reconfigure: vi.fn().mockRejectedValue(new Error('daemon unreachable')) } } },
    )

    await editServerAndUpdate(user)

    expect(container.querySelector('.config-error')?.textContent).toBe('daemon unreachable')
  })

  it('blocks the update when an http-port collides with another UI plugin', async () => {
    var { user, container } = setup(
      <PluginConfigSection fields={[portField]} current={{ PORT: '81' }} installed printerId="printer-1" pluginId="fluidd" otherUiPorts={[80]} />,
    )

    await user.click(screen.getByRole('button', { name: '81' }))
    await user.clear(screen.getByRole('spinbutton'))
    await user.type(screen.getByRole('spinbutton'), '80')

    expect(container.querySelector('.config-error')).not.toBeNull()
    expect(screen.getByRole('button', { name: en('store.update_config') })).toBeDisabled()
  })
})

describe('PluginConfigSection scope control', () => {
  it('renders the per-field segments in edit mode, no microcopy on the hint, and reports a flip with the shown value', async () => {
    var onScopeChange = vi.fn()
    var { user, container } = setup(
      <PluginConfigSection fields={[textField]} current={{ SPOOLMAN_SERVER: 'http://spoolman.example:7912' }} installed={false} printerId="printer-1" pluginId="spoolman" scopes={{ SPOOLMAN_SERVER: 'global' }} onScopeChange={onScopeChange} />,
    )

    expect(container.querySelector('.config-scope-note')).toBeNull()
    await user.click(screen.getByRole('button', { name: en('store.scope_this_printer') }))

    expect(onScopeChange).toHaveBeenCalledWith('SPOOLMAN_SERVER', 'printer', 'http://spoolman.example:7912')
  })

  it('shows the microcopy when the choice differs from the manifest hint', () => {
    var { container } = setup(
      <PluginConfigSection fields={[textField]} current={{}} installed={false} printerId="printer-1" pluginId="spoolman" scopes={{ SPOOLMAN_SERVER: 'printer' }} onScopeChange={vi.fn()} />,
    )

    expect(container.querySelector('.config-scope-note')?.textContent).toBe(en('store.scope_note_printer'))
  })

  it('keeps the control visible with no printer in context, disabling only the This-printer choice and saying why', async () => {
    var onScopeChange = vi.fn()
    var { user, container } = setup(
      <PluginConfigSection fields={[textField]} current={{}} installed={false} pluginId="spoolman" scopes={{ SPOOLMAN_SERVER: 'global' }} onScopeChange={onScopeChange} />,
    )

    expect(container.querySelector('.config-scope')).not.toBeNull()
    expect(screen.getByText(en('store.scope_note_select_printer'))).toBeInTheDocument()
    const thisPrinterSegment = screen.getByRole('button', { name: en('store.scope_this_printer') })
    expect(thisPrinterSegment).toBeDisabled()
    await user.click(thisPrinterSegment)
    expect(onScopeChange).not.toHaveBeenCalled()
  })

  it('explains that an offline printer gets the changes later, and blocks Apply until it is back', async () => {
    var { user } = setup(
      <PluginConfigSection fields={[textField]} current={{ SPOOLMAN_SERVER: 'http://old' }} installed printerSelected pluginId="spoolman" scopes={{ SPOOLMAN_SERVER: 'global' }} onScopeChange={vi.fn()} />,
    )

    expect(screen.getByText(en('store.config_offline_note'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'http://old' }))
    expect(screen.getByRole('button', { name: en('store.scope_this_printer') })).toBeEnabled()
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'http://new')
    expect(screen.getByRole('button', { name: en('store.update_config') })).toBeDisabled()
  })
})
