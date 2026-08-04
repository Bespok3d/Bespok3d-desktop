// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import type { PluginConfigField } from '../../../data/types'
import { AddressField } from './address-field'

const en = makeT('en')

const serverField: PluginConfigField = { key: 'SPOOLMAN_SERVER', label: 'Server', type: 'address', scope: 'global' }

// The address is asked as soon as it stops changing, so a test waits out that pause instead of
// leaving the field.
async function afterTypingPause(): Promise<void> {
  await act(async () => { await new Promise((settled) => setTimeout(settled, 700)) })
}

// Leaving the field is what tidies a pasted link down to the host and port.
async function leaveField(user: ReturnType<typeof setup>['user']): Promise<void> {
  await user.click(screen.getByRole('textbox'))
  await user.tab()
}

describe('AddressField', () => {
  it('turns a pasted browser link into the host and port when the field is left', async () => {
    var onChange = vi.fn()
    var { user } = setup(
      <AddressField field={serverField} value="http://192.168.1.50:8000/spoolman/" onChange={onChange} />,
      { b3d: { net: { probeService: vi.fn().mockResolvedValue(true) } } },
    )

    await leaveField(user)

    expect(onChange).toHaveBeenCalledWith('192.168.1.50:8000')
  })

  it('says something answered when the address is reachable from this computer', async () => {
    var { container } = setup(
      <AddressField field={serverField} value="192.168.1.50:8000" onChange={vi.fn()} />,
      { b3d: { net: { probeService: vi.fn().mockResolvedValue(true) } } },
    )

    await afterTypingPause()

    expect(container.querySelector('.config-reach-ok')?.textContent).toBe(en('store.address_reachable'))
  })

  it('checks the address as soon as it stands still, without waiting to leave the field', async () => {
    var probeService = vi.fn().mockResolvedValue(true)
    setup(
      <AddressField field={serverField} value="192.168.1.50:8000" onChange={vi.fn()} />,
      { b3d: { net: { probeService } } },
    )

    await afterTypingPause()

    expect(probeService).toHaveBeenCalledWith('192.168.1.50', 8000)
  })

  it('warns rather than errors when nothing answers, because the printer may still reach it', async () => {
    var { container } = setup(
      <AddressField field={serverField} value="192.168.1.50:8000" onChange={vi.fn()} />,
      { b3d: { net: { probeService: vi.fn().mockResolvedValue(false) } } },
    )

    await afterTypingPause()

    expect(container.querySelector('.config-reach-warn')?.textContent).toBe(en('store.address_unreachable'))
    expect(container.querySelector('.config-error')).toBeNull()
  })

  it('names an unusable address and never goes looking for it on the network', async () => {
    var probeService = vi.fn().mockResolvedValue(true)
    var { container } = setup(
      <AddressField field={serverField} value="my spoolman server" onChange={vi.fn()} />,
      { b3d: { net: { probeService } } },
    )

    await afterTypingPause()

    expect(container.querySelector('.config-error')?.textContent).toBe(en('store.address_unusable'))
    expect(probeService).not.toHaveBeenCalled()
  })
})
