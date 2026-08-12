// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { RebootProgress } from './RebootProgress'

const RESTART_SECONDS = 42

function barIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.progress-bar')
}

function widthAfter(container: HTMLElement, waitedMs: number): string {
  act(() => { vi.advanceTimersByTime(waitedMs) })

  return barIn(container)?.style.width ?? ''
}

afterEach(function realTimeAgain() {
  vi.useRealTimers()
})

describe('the bar shown while a printer restarts', () => {
  it('shows no number, because a restart has no honest one', () => {
    const { container } = setup(<RebootProgress restartSeconds={RESTART_SECONDS} />)

    expect(container.textContent).toBe('')
  })

  it('fills the width it is given', () => {
    const { container } = setup(<RebootProgress restartSeconds={RESTART_SECONDS} />)

    expect(container.querySelector('.progress')?.classList.contains('u-w-full')).toBe(true)
    expect(barIn(container)?.style.width).toBe('100%')
  })

  it('empties over the restart time the adapter declares', () => {
    vi.useFakeTimers()
    const { container } = setup(<RebootProgress restartSeconds={RESTART_SECONDS} />)

    expect(widthAfter(container, 21_000)).toBe('50%')
    expect(widthAfter(container, 10_500)).toBe('25%')
  })

  it('empties faster for a printer that declares a shorter restart', () => {
    vi.useFakeTimers()
    const { container } = setup(<RebootProgress restartSeconds={20} />)

    expect(widthAfter(container, 5_000)).toBe('75%')
  })

  it('takes itself off the screen once the restart time is up', () => {
    vi.useFakeTimers()
    const { container } = setup(<RebootProgress restartSeconds={RESTART_SECONDS} />)

    act(() => { vi.advanceTimersByTime(RESTART_SECONDS * 1000) })

    expect(barIn(container)).toBe(null)
  })
})
