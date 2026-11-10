// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeAdapterInfo, makePrinter } from '../../../test/fixtures'
import { AccessPane } from './AccessPane'

function clients() {
  return vi.fn().mockResolvedValue({
    clients: [{ identity: 'fpr-other', role: 'admin', label: 'Other PC' }],
    pending: [{ identity: 'fpr-new', label: 'New PC', requested_at: '2026-01-01' }],
  })
}

// A reset the test answers when it chooses, so it can look at the pane while the printer works.
function resetThePrinterAnswersLater() {
  var answer = { now: () => {} }
  var resetAccess = vi.fn(() => new Promise<void>((resolve) => { answer.now = resolve }))

  return { resetAccess, answer }
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

  it('surfaces a grant failure instead of swallowing it', async () => {
    var { user } = renderPane({ access: { clients: clients(), grant: vi.fn().mockRejectedValue(new Error("Error invoking remote method 'access:grant': Error: grant boom")) } })
    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('grant boom')).toBeInTheDocument()
  })

  it('surfaces a revoke failure instead of swallowing it', async () => {
    var { user } = renderPane({ access: { clients: clients(), revoke: vi.fn().mockRejectedValue(new Error('revoke boom')) } })
    await user.click(await screen.findByRole('button', { name: 'Revoke' }))
    expect(await screen.findByText('revoke boom')).toBeInTheDocument()
  })

  it('shows an empty state when nothing is managed', () => {
    setup(<AccessPane printers={[makePrinter({ status: 'online' })]} />)
    expect(screen.getByText('No managed printers yet.')).toBeInTheDocument()
  })
})

describe('AccessPane reset', () => {
  it('re-keys the printer to this computer on reset', async () => {
    var { user, b3d } = renderPane({ access: { clients: clients() } })
    await user.click(await screen.findByRole('button', { name: 'Reset access' }))
    await waitFor(() => expect(b3d.printers.resetAccess).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22))
  })

  it('surfaces a reset failure instead of swallowing it', async () => {
    var { user } = renderPane({
      access: { clients: clients() },
      printers: { resetAccess: vi.fn().mockRejectedValue(new Error("Error invoking remote method 'printer:reset-access': Error: reset boom")) },
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
    expect(screen.getByLabelText('SSH password')).toHaveValue('')

    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
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

  it('never says a reset is running while it waits for their own login', async () => {
    setup(<AccessPane printers={[makePrinter({ status: 'managed', customSshCredentials: true })]} />, { b3d: { access: { clients: clients() } } })
    fireEvent.click(await screen.findByRole('button', { name: 'Reset access' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(await screen.findByLabelText('SSH password')).toBeInTheDocument()
  })
})

describe('AccessPane reset while it runs', () => {
  it('runs one reset at a time, so a second click cannot start another', async () => {
    var printerReset = resetThePrinterAnswersLater()
    var { user, b3d } = renderPane({ access: { clients: clients() }, printers: { resetAccess: printerReset.resetAccess } })
    var resetButton = await screen.findByRole('button', { name: 'Reset access' })
    await user.click(resetButton)
    await waitFor(() => expect(resetButton).toBeDisabled())
    await user.click(resetButton)
    expect(b3d.printers.resetAccess).toHaveBeenCalledTimes(1)

    await act(async () => printerReset.answer.now())
    expect(resetButton).toBeEnabled()
  })

  it('keeps saying the reset is running after their login form closes, until the printer answers', async () => {
    var printerReset = resetThePrinterAnswersLater()
    var { user } = setup(
      <AccessPane printers={[makePrinter({ status: 'managed', customSshCredentials: true })]} />,
      { b3d: { access: { clients: clients() }, printers: { resetAccess: printerReset.resetAccess } } },
    )
    var resetButtons: HTMLElement[]
    await user.click(await screen.findByRole('button', { name: 'Reset access' }))
    await user.type(screen.getByLabelText('SSH password'), 'their-secret')
    resetButtons = screen.getAllByRole('button', { name: 'Reset access' })
    await user.click(resetButtons[resetButtons.length - 1])
    expect(screen.queryByLabelText('SSH password')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Resetting access on this printer')

    await act(async () => printerReset.answer.now())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says why a reset cannot run when the app has no adapter for the printer', async () => {
    var { user, b3d } = renderPane({ access: { clients: clients() }, printers: { adapterGet: vi.fn().mockResolvedValue(null) } })
    await user.click(await screen.findByRole('button', { name: 'Reset access' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Reset access cannot run: this copy of Bespok3d has no adapter for this printer \(snapmaker-u1\)/)
    expect(b3d.printers.resetAccess).not.toHaveBeenCalled()
  })

  it('names a refused SSH port by the port of the login it used', async () => {
    var { user } = renderPane({
      access: { clients: clients() },
      printers: {
        adapterGet: vi.fn().mockResolvedValue(makeAdapterInfo({ defaults: { sshUser: 'root', sshPort: 2222, sshPasswordHint: '', runtimeUser: 'lava' } })),
        resetAccess: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:2222')),
      },
    })
    await user.click(await screen.findByRole('button', { name: 'Reset access' }))
    expect(await screen.findByText(/^The printer refused the SSH connection/)).toBeInTheDocument()
  })

  it('answers a reset the app refuses because another one runs, in user words', async () => {
    var busyAnswer = "Error invoking remote method 'printer:reset-access': Error: A reset of access is already running on this printer"
    var { user } = renderPane({ access: { clients: clients() }, printers: { resetAccess: vi.fn().mockRejectedValue(new Error(busyAnswer)) } })
    await user.click(await screen.findByRole('button', { name: 'Reset access' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^A reset of access is already running on this printer\. Wait for it/)
  })
})
