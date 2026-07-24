// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeAdapterInfo } from '../../../test/fixtures'
import { AdaptersPane } from './AdaptersPane'

describe('AdaptersPane', () => {
  it('lists installed adapters', () => {
    setup(<AdaptersPane adapters={[makeAdapterInfo({ title: 'Snapmaker U1', vendor: 'Snapmaker', version: '1.0.0' })]} printers={[]} />)
    expect(screen.getByText('Snapmaker U1')).toBeInTheDocument()
  })

  it('shows an empty state when no adapters are loaded', () => {
    setup(<AdaptersPane adapters={[]} printers={[]} />)
    expect(screen.getByText('No adapters loaded.')).toBeInTheDocument()
  })
})
