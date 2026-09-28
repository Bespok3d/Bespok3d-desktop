// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makePrinter } from '../../test/fixtures'
import { RequestAccessModal } from './RequestAccessModal'
import type { B3dOverrides } from '../../test/b3d-mock'

function renderModal(onGranted: ReturnType<typeof vi.fn>, b3d: B3dOverrides = {}, onReEnroll = vi.fn(), onClose = vi.fn()) {
  return setup(<RequestAccessModal printer={makePrinter({ id: 'printer-1' })} state="present-awaiting-access" onClose={onClose as () => void} onGranted={onGranted as (printerId: string) => void} onReEnroll={onReEnroll} />, { b3d })
}

describe('RequestAccessModal polling flow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('requests access, polls until granted, and reports the grant on Done', async () => {
    var status = vi.fn().mockResolvedValueOnce('pending').mockResolvedValue('granted')
    var onGranted = vi.fn()
    var { b3d } = renderModal(onGranted, { access: { status } })

    fireEvent.click(screen.getByRole('button', { name: 'Guide me' }))
    expect(b3d.access.request).toHaveBeenCalledWith('printer-1', '')
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('Access granted')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onGranted).toHaveBeenCalledWith('printer-1')
  })
})

describe('RequestAccessModal failure', () => {
  it('shows a failure result when the request is rejected', async () => {
    var request = vi.fn().mockRejectedValue(new Error('pending cap reached'))
    var onGranted = vi.fn()
    var onReEnroll = vi.fn()
    var { user } = renderModal(onGranted, { access: { request } }, onReEnroll)
    await user.click(screen.getByRole('button', { name: 'Just the steps' }))
    expect(await screen.findByText('Request failed')).toBeInTheDocument()
    expect(screen.getByText(/pending cap reached/)).toBeInTheDocument()
    expect(onGranted).not.toHaveBeenCalled()
    expect(onReEnroll).not.toHaveBeenCalled()
  })

  it('allows a pending request to be cancelled without reporting a grant', async () => {
    var onGranted = vi.fn()
    var onClose = vi.fn()
    var { user } = renderModal(onGranted, { access: { request: vi.fn().mockResolvedValue({ ok: true }) } }, vi.fn(), onClose)
    await user.click(screen.getByRole('button', { name: 'Just the steps' }))
    await screen.findByText('Waiting for approval')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onGranted).not.toHaveBeenCalled()
  })
})
