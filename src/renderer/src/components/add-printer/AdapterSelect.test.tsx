// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeAdapterInfo } from '../../test/fixtures'
import { AdapterSelect } from './AdapterSelect'

// Every adapter id this build registers, the two klipper-linux ids included: one code base can
// register more than one id, and the picker has to offer each of them by its own title.
function registeredAdapters(): AdapterInfo[] {
  return [
    makeAdapterInfo(),
    makeAdapterInfo({ id: 'voron-24', title: 'Voron 2.4', vendor: 'Voron Design', description: 'Stock Klipper adapter for a Voron 2.4.' }),
    makeAdapterInfo({ id: 'klipper-generic', title: 'Klipper: generic', vendor: 'Any maker', description: 'Stock Klipper adapter for any Klipper on Linux printer.' }),
  ]
}

describe('AdapterSelect', () => {
  it('lists every adapter it was given as an option', () => {
    setup(<AdapterSelect adapters={registeredAdapters()} adapterId="snapmaker-u1" onChange={vi.fn()} />)
    registeredAdapters().forEach((adapter) => {
      expect(screen.getByRole('option', { name: `${adapter.title} · ${adapter.vendor}` })).toBeInTheDocument()
    })
  })

  // The picker is the list of adapters the build registered and nothing else; an adapter that is not
  // in the list cannot be picked, which is the whole point of reading it over IPC.
  it('offers nothing when the build registered no adapters', () => {
    setup(<AdapterSelect adapters={[]} adapterId="" onChange={vi.fn()} />)
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('shows the description of the selected adapter', () => {
    setup(<AdapterSelect adapters={registeredAdapters()} adapterId="voron-24" onChange={vi.fn()} />)
    expect(screen.getByText('Stock Klipper adapter for a Voron 2.4.')).toBeInTheDocument()
  })

  it('reports the picked adapter id through onChange', async () => {
    var onChange = vi.fn()
    var { user } = setup(<AdapterSelect adapters={registeredAdapters()} adapterId="snapmaker-u1" onChange={onChange} />)
    await user.selectOptions(screen.getByRole('combobox'), 'voron-24')
    expect(onChange).toHaveBeenCalledWith('voron-24')
  })
})
