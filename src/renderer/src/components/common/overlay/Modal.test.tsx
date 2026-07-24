// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { Modal } from './Modal'

interface RenderOptions {
  onClose?: () => void
  dismissable?: boolean
}

function renderModal(options: RenderOptions = {}) {
  return setup(
    <Modal onClose={options.onClose} dismissable={options.dismissable}>
      <h2>Heading</h2>
      <button>First</button>
      <button>Last</button>
    </Modal>,
  )
}

describe('Modal scaffold', () => {
  it('renders a dialog surface with aria-modal and the default classes', () => {
    var { container } = renderModal({ onClose: vi.fn() })
    var dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveClass('modal')
    expect(container.querySelector('.modal-scrim')).not.toBeNull()
  })

  it('closes on Escape when dismissable', () => {
    var onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('ignores Escape when dismissable is false', () => {
    var onClose = vi.fn()
    renderModal({ onClose, dismissable: false })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('dismisses on a genuine backdrop press-and-release', () => {
    var onClose = vi.fn()
    var { container } = renderModal({ onClose })
    var scrim = container.querySelector('.modal-scrim') as HTMLElement
    fireEvent.pointerDown(scrim)
    fireEvent.pointerUp(scrim)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not dismiss on a click inside the surface', () => {
    var onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByRole('heading'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('moves focus into the modal on open', () => {
    renderModal({ onClose: vi.fn() })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }))
  })

  it('traps Tab so it cycles back to the first focusable from the last', () => {
    renderModal({ onClose: vi.fn() })
    const last = screen.getByRole('button', { name: 'Last' })
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }))
  })

  it('traps Shift+Tab so it cycles to the last focusable from the first', () => {
    renderModal({ onClose: vi.fn() })
    const first = screen.getByRole('button', { name: 'First' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }))
  })
})
