// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, it, expect } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { SettingRow } from './SettingRow'

afterEach(cleanup)

describe('SettingRow', () => {
  it('renders the label, hint, and controls into the set-row slots', () => {
    const { container } = render(
      <SettingRow label="Theme" hint="Pick a look" controls={<button>Pick</button>} />,
    )
    expect(container.querySelector('.set-row .set-row-text .set-row-label')?.textContent).toBe('Theme')
    expect(container.querySelector('.set-row-hint')?.textContent).toBe('Pick a look')
    expect(container.querySelector('.set-row-control button')?.textContent).toBe('Pick')
  })

  it('omits the hint and control slots when not provided', () => {
    const { container } = render(<SettingRow label="Bare" />)
    expect(container.querySelector('.set-row-label')?.textContent).toBe('Bare')
    expect(container.querySelector('.set-row-hint')).toBeNull()
    expect(container.querySelector('.set-row-control')).toBeNull()
  })

  it('appends extra classes to the row (e.g. the vertical modifier)', () => {
    const { container } = render(<SettingRow label="X" className="vertical" />)
    expect(container.querySelector('.set-row')).toHaveClass('vertical')
  })
})
