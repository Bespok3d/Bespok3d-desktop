// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makePlugin } from '../../../test/fixtures'
import type { PluginConfigField } from '../../../data/types'
import { PanelConfigArea } from './config-form'

// The panel's own buttons (install, switch version) are gated on the values the Config tab reports up.
// An installed plugin used to report nothing at all, so the footer went on asking for a protocol that
// was already on screen and the version switch stayed shut.

const FIELDS: PluginConfigField[] = [
  { key: 'SPOOLMAN_SERVER', label: 'Server address', type: 'url', scope: 'global', userEditable: true },
]
const PLUGIN = makePlugin({ id: 'spoolman', config: FIELDS })

const SAVED_WITHOUT_PROTOCOL = { SPOOLMAN_SERVER: '192.0.2.50:8000' }

function installedArea(onMultiVars: (values: Record<string, string>) => void, live: Record<string, string>) {
  return setup(
    <PanelConfigArea
      plugin={PLUGIN} installed printerId="printer-1"
      multiVars={SAVED_WITHOUT_PROTOCOL} onMultiVars={onMultiVars} onApplied={() => {}}
    />,
    {
      b3d: {
        store: { pluginConfig: vi.fn().mockResolvedValue(live) },
        net: { probeServiceUrl: vi.fn().mockResolvedValue(200) },
      },
    },
  )
}

describe('what the installed Config tab reports to the panel', () => {
  it('hands over the address on screen as soon as it is shown, so the panel stops judging its older copy', async () => {
    var onMultiVars = vi.fn()
    installedArea(onMultiVars, { SPOOLMAN_SERVER: 'http://192.0.2.50:8000' })

    await waitFor(() => expect(onMultiVars).toHaveBeenCalledWith({ SPOOLMAN_SERVER: 'http://192.0.2.50:8000' }))
  })

  it('hands over the protocol the moment it is picked', async () => {
    var onMultiVars = vi.fn()
    var { user, container } = installedArea(onMultiVars, SAVED_WITHOUT_PROTOCOL)

    await user.click(await screen.findByRole('button', { name: '192.0.2.50:8000' }))
    await user.selectOptions(container.querySelector('.config-fields select') as HTMLSelectElement, 'https')

    await waitFor(() => expect(onMultiVars).toHaveBeenLastCalledWith({ SPOOLMAN_SERVER: 'https://192.0.2.50:8000' }))
  })
})
