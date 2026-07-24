// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makePrinter } from '../../../test/fixtures'
import { AccessPane } from './AccessPane'

function clients() {
  return vi.fn().mockResolvedValue({
    clients: [{ identity: 'fpr-other', role: 'admin', label: 'Other PC' }],
    pending: [{ identity: 'fpr-new', label: 'New PC', requested_at: '2026-01-01' }],
  })
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

  it('shows an empty state when nothing is managed', () => {
    setup(<AccessPane printers={[makePrinter({ status: 'online' })]} />)
    expect(screen.getByText('No managed printers yet.')).toBeInTheDocument()
  })
})
