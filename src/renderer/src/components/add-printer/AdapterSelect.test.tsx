// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { AdapterSelect } from './AdapterSelect'
import { BUNDLED_ADAPTERS } from '../../data/catalog/bundled'

describe('AdapterSelect', () => {
  it('lists every bundled adapter as an option', () => {
    setup(<AdapterSelect adapterId="snapmaker-u1" onChange={vi.fn()} />)
    BUNDLED_ADAPTERS.forEach((adapter) => {
      expect(screen.getByRole('option', { name: `${adapter.title} · ${adapter.vendor}` })).toBeInTheDocument()
    })
  })

  it('shows the description of the selected adapter', () => {
    setup(<AdapterSelect adapterId="voron-24" onChange={vi.fn()} />)
    expect(screen.getByText('Generic Klipper bridge for stock Voron 2.4 builds.')).toBeInTheDocument()
  })

  it('reports the picked adapter id through onChange', async () => {
    var onChange = vi.fn()
    var { user } = setup(<AdapterSelect adapterId="snapmaker-u1" onChange={onChange} />)
    await user.selectOptions(screen.getByRole('combobox'), 'voron-24')
    expect(onChange).toHaveBeenCalledWith('voron-24')
  })
})
