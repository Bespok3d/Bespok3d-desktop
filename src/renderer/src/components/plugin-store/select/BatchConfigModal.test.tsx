// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makePlugin } from '../../../test/fixtures'
import { BatchConfigModal } from './BatchConfigModal'

function noop() {}

const LOCATION_PLUGIN = makePlugin({
  id: 'spoolman', title: 'Spoolman',
  config: [{ key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', scope: 'printer' }],
})

describe('BatchConfigModal scope treatment', () => {
  it('renders no scope control when the flow threads no scope choices', () => {
    setup(
      <BatchConfigModal plugins={[LOCATION_PLUGIN]} savedVars={{}} busy={false} onCancel={noop} onConfirm={noop} />,
    )
    expect(screen.queryByText('All printers')).not.toBeInTheDocument()
    expect(screen.queryByText('This printer')).not.toBeInTheDocument()
  })

  it('presets each field from the threaded choice and reports a flip', async () => {
    var onScopeChange = vi.fn()
    var { user } = setup(
      <BatchConfigModal
        plugins={[LOCATION_PLUGIN]} savedVars={{}} busy={false}
        scopes={{ SPOOLMAN_LOCATION: 'printer' }} onScopeChange={onScopeChange}
        onCancel={noop} onConfirm={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'This printer' })).toHaveClass('active')
    await user.click(screen.getByRole('button', { name: 'All printers' }))
    expect(onScopeChange).toHaveBeenCalledWith('SPOOLMAN_LOCATION', 'global')
  })
})
