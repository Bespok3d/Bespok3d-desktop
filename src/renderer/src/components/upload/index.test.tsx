// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen, act } from '@testing-library/react'
import { setup } from '../../test/harness'
import { UploadBar } from '.'

describe('UploadBar', () => {
  it('shows the upload percent while a transfer to that printer is in flight', () => {
    const { emit } = setup(<UploadBar printerId="p1" />)
    act(() => emit.uploadProgress({ printerId: 'p1', sent: 50, total: 200 }))
    expect(screen.getByText('Uploading 25%')).toBeInTheDocument()
  })

  it('ignores upload events meant for a different printer', () => {
    const { emit } = setup(<UploadBar printerId="p1" />)
    act(() => emit.uploadProgress({ printerId: 'other', sent: 50, total: 200 }))
    expect(screen.queryByText(/Uploading/)).not.toBeInTheDocument()
  })

  it('clears once the upload completes so the phase feed takes over', () => {
    const { emit } = setup(<UploadBar printerId="p1" />)
    act(() => emit.uploadProgress({ printerId: 'p1', sent: 100, total: 200 }))
    expect(screen.getByText('Uploading 50%')).toBeInTheDocument()
    act(() => emit.uploadProgress({ printerId: 'p1', sent: 200, total: 200 }))
    expect(screen.queryByText(/Uploading/)).not.toBeInTheDocument()
  })
})
