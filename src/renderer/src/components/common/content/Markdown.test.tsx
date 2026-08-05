// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown b3d:// links', () => {
  it('keeps a b3d:// link clickable and resolves it in-app (not stripped by sanitization)', () => {
    const onB3dRef = vi.fn()
    render(
      <Markdown
        source="[Captured output](b3d://bespok3d/octoeverywhere#captured)"
        onB3dRef={onB3dRef}
      />,
    )
    const link = screen.getByText('Captured output')
    expect(link.className).toContain('b3d-ref')
    fireEvent.click(link)
    expect(onB3dRef).toHaveBeenCalledWith({
      publisher: 'bespok3d',
      name: 'octoeverywhere',
      tab: 'captured',
    })
  })

  it('still strips an unsafe javascript: href', () => {
    render(<Markdown source="[x](javascript:alert(1))" onB3dRef={vi.fn()} />)
    expect(screen.getByText('x').getAttribute('href') ?? '').not.toContain('javascript')
  })

  it('leaves a normal https link intact and external', () => {
    render(<Markdown source="[site](https://octoeverywhere.com)" onB3dRef={vi.fn()} />)
    const link = screen.getByText('site')
    expect(link.getAttribute('href')).toBe('https://octoeverywhere.com')
    expect(link.getAttribute('target')).toBe('_blank')
  })
})

// The attribution tables our plugin docs are written in are GitHub-flavoured markdown. Without the GFM
// plugin they rendered as a paragraph full of pipe characters.
describe('Markdown GitHub-flavoured tables', () => {
  const CREDITS_TABLE = '| Upstream project | Licence |\n| --- | --- |\n| Spoolman | AGPL-3.0 |\n'

  it('renders a pipe table as a real table, not a line of pipes', () => {
    const { container } = render(<Markdown source={CREDITS_TABLE} />)
    expect(container.querySelectorAll('table')).toHaveLength(1)
    expect(screen.getByText('Upstream project').tagName).toBe('TH')
    expect(screen.getByText('AGPL-3.0').tagName).toBe('TD')
    expect(container.textContent).not.toContain('|')
  })

  it('renders a bare url as a link', () => {
    render(<Markdown source="Upstream: https://github.com/Donkie/Spoolman" />)
    expect(screen.getByText('https://github.com/Donkie/Spoolman').getAttribute('href')).toBe('https://github.com/Donkie/Spoolman')
  })
})
