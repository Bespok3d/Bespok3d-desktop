// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import type { PluginConfigField } from '../../../data/types'
import { PluginConfigSection } from './config-section'
import { makeT } from '../../../i18n'

const en = makeT('en')

const serverField: PluginConfigField = { key: 'SPOOLMAN_SERVER', label: 'Server', type: 'url', scope: 'global' }

const SAVED_WITHOUT_PROTOCOL = { SPOOLMAN_SERVER: '192.0.2.50:8000' }

// An address saved before protocols were asked for: the panel footer judges it, so what the section
// shows must reach the panel or the footer keeps asking for something the user already picked.
function installedSection(onValuesChange: (values: Record<string, string>) => void, reconfigure = vi.fn()) {
  return setup(
    <PluginConfigSection
      fields={[serverField]}
      current={SAVED_WITHOUT_PROTOCOL}
      installed
      printerId="printer-1"
      pluginId="spoolman"
      onValuesChange={onValuesChange}
    />,
    { b3d: { store: { reconfigure } } },
  )
}

async function pickHttps(user: ReturnType<typeof setup>['user'], container: HTMLElement): Promise<void> {
  await user.click(container.querySelector('.config-value') as HTMLButtonElement)
  await user.selectOptions(screen.getByRole('combobox'), 'https')
}

describe('PluginConfigSection', () => {
  it('reports the address on screen even when the plugin is already installed', async () => {
    var onValuesChange = vi.fn()
    var { user, container } = installedSection(onValuesChange)

    await pickHttps(user, container)

    expect(onValuesChange).toHaveBeenLastCalledWith({ SPOOLMAN_SERVER: 'https://192.0.2.50:8000' })
  })

  it('puts the saved address back in front of the panel when the edit is cancelled', async () => {
    var onValuesChange = vi.fn()
    var { user, container } = installedSection(onValuesChange)

    await pickHttps(user, container)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onValuesChange).toHaveBeenLastCalledWith(SAVED_WITHOUT_PROTOCOL)
  })

  // main-index issue 13: a reconfigure whose call to the printer's daemon got no answer.
  it('says the printer did not answer when applying timed out, with the raw words one click away', async () => {
    var unansweredCall = "Error invoking remote method 'store:reconfigure': Error: connect ETIMEDOUT 192.0.2.50:4269"
    var { user, container } = installedSection(vi.fn(), vi.fn().mockRejectedValue(new Error(unansweredCall)))

    await pickHttps(user, container)
    await user.click(screen.getByRole('button', { name: en('store.update_config') }))

    expect(await screen.findByText(en('failure.printer_no_answer'))).toBeInTheDocument()
    expect(screen.queryByText(unansweredCall)).toBeNull()
    await user.click(screen.getByTitle(en('explainer.show')))
    expect(screen.getByText(unansweredCall)).toBeInTheDocument()
  })
})

// The camera plugin saves its freeze-recovery toggle as "1", and the installed view showed that "1"
// where the user expects to read whether the setting is on.
describe('an installed toggle setting', () => {
  const freezeRecovery: PluginConfigField = { key: 'CAMERA_FREEZE_RECOVERY', label: 'Wake a frozen built-in camera', type: 'toggle', scope: 'global', onValue: '1', offValue: '0' }

  function shownFor(saved: string): string {
    var { container } = setup(<PluginConfigSection fields={[freezeRecovery]} current={{ CAMERA_FREEZE_RECOVERY: saved }} installed printerId="printer-1" pluginId="u1-hw-camera" />)

    return container.querySelector('.config-value')?.textContent ?? ''
  }

  it('reads On for the plugin word for on', () => {
    expect(shownFor('1')).toBe(en('store.config_on'))
  })

  it('reads Off for the plugin word for off', () => {
    expect(shownFor('0')).toBe(en('store.config_off'))
  })
})
