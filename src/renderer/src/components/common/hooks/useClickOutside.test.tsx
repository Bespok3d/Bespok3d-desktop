// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useRef } from 'react'
import { fireEvent } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { useClickOutside } from './useClickOutside'

function Probe({ onOutside, enabled }: { onOutside: () => void; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onOutside, enabled)

  return (
    <div>
      <div ref={ref}>
        <button data-testid="inside">inside</button>
      </div>
      <button data-testid="outside">outside</button>
    </div>
  )
}

describe('useClickOutside', () => {
  it('fires when a press lands outside the ref', () => {
    const onOutside = vi.fn()
    const view = setup(<Probe onOutside={onOutside} />)
    fireEvent.mouseDown(view.getByTestId('outside'))
    expect(onOutside).toHaveBeenCalledTimes(1)
  })

  it('does not fire when the press lands inside the ref', () => {
    const onOutside = vi.fn()
    const view = setup(<Probe onOutside={onOutside} />)
    fireEvent.mouseDown(view.getByTestId('inside'))
    expect(onOutside).not.toHaveBeenCalled()
  })

  it('attaches no listener while disabled (the leak the unguarded copies had)', () => {
    const onOutside = vi.fn()
    const view = setup(<Probe onOutside={onOutside} enabled={false} />)
    fireEvent.mouseDown(view.getByTestId('outside'))
    expect(onOutside).not.toHaveBeenCalled()
  })

  it('removes its listener on unmount', () => {
    const onOutside = vi.fn()
    const view = setup(<Probe onOutside={onOutside} />)
    view.unmount()
    fireEvent.mouseDown(document.body)
    expect(onOutside).not.toHaveBeenCalled()
  })
})
