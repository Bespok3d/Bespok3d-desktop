// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makePlugin } from '../../../test/fixtures'
import { BatchConfigModal } from './BatchConfigModal'

function noop() {}

const LOCATION_PLUGIN = makePlugin({
  id: 'spoolman', title: 'Spoolman',
  config: [{ key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', scope: 'printer', required: true }],
})

describe('BatchConfigModal required capture', () => {
  const plugins = [
    makePlugin({ id: 'first', title: 'First', config: [
      { key: 'SERVER', label: 'First server', type: 'text', scope: 'global', required: true },
      { key: 'OPTIONAL', label: 'Optional', type: 'text', scope: 'global' },
    ] }),
    makePlugin({ id: 'second', title: 'Second', config: [
      { key: 'SERVER', label: 'Second server', type: 'text', scope: 'global', required: true },
    ] }),
  ]

  it('keeps matching field keys separate and excludes optional fields', async () => {
    const onConfirm = vi.fn()
    const { user } = setup(<BatchConfigModal plugins={plugins} savedVars={{}} busy={false} onCancel={noop} onConfirm={onConfirm} />)
    const install = screen.getByRole('button', { name: 'Install 2' })
    expect(install).toBeDisabled()
    expect(screen.queryByText('Optional')).not.toBeInTheDocument()
    await user.type(within(screen.getByText('First').closest('.batch-config-group') as HTMLElement).getByRole('textbox'), 'first.local')
    expect(install).toBeDisabled()
    await user.type(within(screen.getByText('Second').closest('.batch-config-group') as HTMLElement).getByRole('textbox'), 'second.local')
    await user.click(install)
    expect(onConfirm).toHaveBeenCalledWith({ first: { SERVER: 'first.local' }, second: { SERVER: 'second.local' } })
  })

  it('cancels without sending values', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { user } = setup(<BatchConfigModal plugins={plugins} savedVars={{}} busy={false} onCancel={onCancel} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('blocks a required URL until its address is usable', async () => {
    const urlPlugin = makePlugin({ id: 'url', config: [{ key: 'SERVER', label: 'Server', type: 'url', scope: 'global', required: true }] })
    const { user } = setup(<BatchConfigModal plugins={[urlPlugin]} savedVars={{}} busy={false} onCancel={noop} onConfirm={noop} />)
    const install = screen.getByRole('button', { name: 'Install 1' })
    await user.type(screen.getByRole('textbox'), 'server.local:8000')
    expect(install).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox'), 'http')
    expect(install).toBeEnabled()
  })
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
