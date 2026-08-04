// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { act, screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import type { PluginConfigField } from '../../../data/types'
import { UrlField } from './url-field'

const en = makeT('en')

const serverField: PluginConfigField = { key: 'SPOOLMAN_SERVER', label: 'Server', type: 'url', scope: 'global' }

// The address is asked as soon as it stops changing, so a test waits out that pause rather than
// leaving the field: choosing a protocol never leaves it, and that was the whole complaint.
async function afterTypingPause(): Promise<void> {
  await act(async () => { await new Promise((settled) => setTimeout(settled, 700)) })
}

// The field as the config form drives it: what is typed and what is picked both come back into it.
function FieldUnderTest({ typed }: { typed: string }) {
  const [address, setAddress] = useState(typed)

  return <UrlField field={serverField} value={address} onChange={setAddress} />
}

describe('UrlField', () => {
  it('keeps a name behind a certificate exactly as typed and asks that whole address', async () => {
    var onChange = vi.fn()
    var probeServiceUrl = vi.fn().mockResolvedValue(200)
    setup(
      <UrlField field={serverField} value="https://spoolman.example.org/" onChange={onChange} />,
      { b3d: { net: { probeServiceUrl } } },
    )

    await afterTypingPause()

    expect(onChange).not.toHaveBeenCalled()
    expect(probeServiceUrl).toHaveBeenCalledWith('https://spoolman.example.org/')
  })

  it('puts the chosen protocol in front of a bare address and moves nothing else', async () => {
    var onChange = vi.fn()
    var { user } = setup(
      <UrlField field={serverField} value="192.0.2.50:8000" onChange={onChange} />,
      { b3d: { net: { probeServiceUrl: vi.fn().mockResolvedValue(200) } } },
    )

    await user.selectOptions(screen.getByRole('combobox'), 'https')

    expect(onChange).toHaveBeenCalledWith('https://192.0.2.50:8000')
  })

  it('asks the address the moment a protocol is picked, without waiting to leave the field', async () => {
    var probeServiceUrl = vi.fn().mockResolvedValue(200)
    var { user } = setup(<FieldUnderTest typed="192.0.2.50:8000" />, { b3d: { net: { probeServiceUrl } } })

    await user.selectOptions(screen.getByRole('combobox'), 'https')
    await afterTypingPause()

    expect(probeServiceUrl).toHaveBeenCalledWith('https://192.0.2.50:8000')
  })

  it('asks for a protocol before it goes looking for a bare address', async () => {
    var probeServiceUrl = vi.fn().mockResolvedValue(200)
    var { container } = setup(
      <UrlField field={serverField} value="192.0.2.50:8000" onChange={vi.fn()} />,
      { b3d: { net: { probeServiceUrl } } },
    )

    await afterTypingPause()

    expect(container.querySelector('.config-error')?.textContent).toBe(en('store.address_pick_scheme'))
    expect(probeServiceUrl).not.toHaveBeenCalled()
  })

  it('warns rather than errors when nothing answers, because the printer may still reach it', async () => {
    var { container } = setup(
      <UrlField field={serverField} value="http://192.0.2.50:8000" onChange={vi.fn()} />,
      { b3d: { net: { probeServiceUrl: vi.fn().mockResolvedValue(null) } } },
    )

    await afterTypingPause()

    expect(container.querySelector('.config-reach-warn')?.textContent).toBe(en('store.address_unreachable'))
    expect(container.querySelector('.config-error')).toBeNull()
  })

  it('says which http code came back when something is there but not serving that address', async () => {
    var { container } = setup(
      <UrlField field={serverField} value="http://192.0.2.50:8000" onChange={vi.fn()} />,
      { b3d: { net: { probeServiceUrl: vi.fn().mockResolvedValue(404) } } },
    )

    await afterTypingPause()

    expect(container.querySelector('.config-reach-warn')?.textContent).toBe(en('store.address_http_error', { code: 404 }))
    expect(container.querySelector('.config-error')).toBeNull()
  })

  it('names an address it cannot read and never goes looking for it', async () => {
    var probeServiceUrl = vi.fn().mockResolvedValue(200)
    var { container } = setup(
      <UrlField field={serverField} value="ftp://spoolman.example.org" onChange={vi.fn()} />,
      { b3d: { net: { probeServiceUrl } } },
    )

    await afterTypingPause()

    expect(container.querySelector('.config-error')?.textContent).toBe(en('store.address_unusable'))
    expect(probeServiceUrl).not.toHaveBeenCalled()
  })
})
