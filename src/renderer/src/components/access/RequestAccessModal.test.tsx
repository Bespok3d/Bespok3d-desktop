// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makePrinter } from '../../test/fixtures'
import { RequestAccessModal } from './RequestAccessModal'
import type { B3dOverrides } from '../../test/b3d-mock'

function renderModal(onGranted: ReturnType<typeof vi.fn>, b3d: B3dOverrides = {}) {
  return setup(<RequestAccessModal printer={makePrinter({ id: 'printer-1' })} onClose={vi.fn()} onGranted={onGranted} />, { b3d })
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
    var { user } = renderModal(vi.fn(), { access: { request } })
    await user.click(screen.getByRole('button', { name: 'Just the steps' }))
    expect(await screen.findByText('Request failed')).toBeInTheDocument()
    expect(screen.getByText(/pending cap reached/)).toBeInTheDocument()
  })
})
