// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Segmented } from './Segmented'

afterEach(cleanup)

const OPTIONS = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
]

describe('Segmented', () => {
  it('renders one button per option and marks the selected one active', () => {
    const { container } = render(<Segmented value="metric" options={OPTIONS} onChange={vi.fn()} />)
    const buttons = container.querySelectorAll('.segmented .seg')
    expect(buttons).toHaveLength(2)
    expect(screen.getByText('Metric')).toHaveClass('active')
    expect(screen.getByText('Imperial')).not.toHaveClass('active')
  })

  it('reports the picked value on click', () => {
    const onChange = vi.fn()
    render(<Segmented value="metric" options={OPTIONS} onChange={onChange} />)
    fireEvent.click(screen.getByText('Imperial'))
    expect(onChange).toHaveBeenCalledWith('imperial')
  })

  it('renders an option icon when provided', () => {
    const options = [{ value: 'light', label: 'Light', icon: <svg data-testid="sun" /> }]
    render(<Segmented value="light" options={options} onChange={vi.fn()} />)
    expect(screen.getByTestId('sun')).not.toBeNull()
  })

  it('keeps a disabled option visible but unclickable', () => {
    const onChange = vi.fn()
    const options = [OPTIONS[0], { ...OPTIONS[1], disabled: true }]
    render(<Segmented value="metric" options={options} onChange={onChange} />)
    const imperialSegment = screen.getByText('Imperial')
    expect(imperialSegment).toBeDisabled()
    fireEvent.click(imperialSegment)
    expect(onChange).not.toHaveBeenCalled()
  })
})
