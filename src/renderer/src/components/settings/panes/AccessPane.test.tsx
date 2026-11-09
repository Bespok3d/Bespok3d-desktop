// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeAdapterInfo, makePrinter } from '../../../test/fixtures'
import { AccessPane } from './AccessPane'

function clients() {
  return vi.fn().mockResolvedValue({
    clients: [{ identity: 'fpr-other', role: 'admin', label: 'Other PC' }],
    pending: [{ identity: 'fpr-new', label: 'New PC', requested_at: '2026-01-01' }],
  })
}

// The login form's labels are not tied to their inputs, so the password field is found by its kind.
function sshPasswordField(): HTMLInputElement {
  var field = document.querySelector<HTMLInputElement>('input[type="password"]')
  if (!field) throw new Error('no SSH password field on screen')

  return field
}

function renderPane(b3d = {}) {
  return setup(<AccessPane printers={[makePrinter({ status: 'managed' })]} />, { b3d })
}

describe('AccessPane', () => {
  it('approves a pending request and revokes a client', async () => {
    var { user, b3d } = renderPane({ access: { clients: clients() } })
    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    expect(b3d.access.grant).toHaveBeenCalledWith('printer-1', 'fpr-new')

    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(b3d.access.revoke).toHaveBeenCalledWith('printer-1', 'fpr-other')
  })

  it('re-keys the printer to this computer on reset', async () => {
    var { user, b3d } = renderPane({ access: { clients: clients() } })
    await user.click(await screen.findByRole('button', { name: 'Reset access' }))
    await waitFor(() => expect(b3d.printers.resetAccess).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22))
  })

  it('surfaces a grant failure instead of swallowing it', async () => {
    var { user } = renderPane({ access: { clients: clients(), grant: vi.fn().mockRejectedValue(new Error('grant boom')) } })
    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('grant boom')).toBeInTheDocument()
  })

  it('surfaces a revoke failure instead of swallowing it', async () => {
    var { user } = renderPane({ access: { clients: clients(), revoke: vi.fn().mockRejectedValue(new Error('revoke boom')) } })
    await user.click(await screen.findByRole('button', { name: 'Revoke' }))
    expect(await screen.findByText('revoke boom')).toBeInTheDocument()
  })

  it('surfaces a reset failure instead of swallowing it', async () => {
    var { user } = renderPane({
      access: { clients: clients() },
      printers: { resetAccess: vi.fn().mockRejectedValue(new Error('reset boom')) },
    })
    await user.click(await screen.findByRole('button', { name: 'Reset access' }))
    expect(await screen.findByText('reset boom')).toBeInTheDocument()
  })

  it('resets a printer with its own SSH login with that login, never the factory one', async () => {
    var factoryAdapter = makeAdapterInfo({ defaults: { sshUser: 'root', sshPort: 22, sshPasswordHint: 'snapmaker', runtimeUser: 'lava' } })
    var { user, b3d } = setup(
      <AccessPane printers={[makePrinter({ status: 'managed', customSshCredentials: true })]} />,
      { b3d: { access: { clients: clients() }, printers: { adapterGet: vi.fn().mockResolvedValue(factoryAdapter) } } },
    )
    var resetButtons: HTMLElement[]
    await user.click(await screen.findByRole('button', { name: 'Reset access' }))
    expect(await screen.findByDisplayValue('root')).toBeInTheDocument()
    expect(sshPasswordField().value).toBe('')

    await user.type(sshPasswordField(), 'their-secret')
    resetButtons = screen.getAllByRole('button', { name: 'Reset access' })
    await user.click(resetButtons[resetButtons.length - 1])
    expect(b3d.printers.resetAccess).toHaveBeenCalledTimes(1)
    expect(b3d.printers.resetAccess).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', 'their-secret', 22)
  })

  it('answers a refused reset login in user words', async () => {
    var { user } = renderPane({
      access: { clients: clients() },
      printers: { resetAccess: vi.fn().mockRejectedValue(new Error('All configured authentication methods failed')) },
    })
    await user.click(await screen.findByRole('button', { name: 'Reset access' }))
    expect(await screen.findByText(/^The printer refused the SSH login\./)).toBeInTheDocument()
  })

  it('shows an empty state when nothing is managed', () => {
    setup(<AccessPane printers={[makePrinter({ status: 'online' })]} />)
    expect(screen.getByText('No managed printers yet.')).toBeInTheDocument()
  })
})
