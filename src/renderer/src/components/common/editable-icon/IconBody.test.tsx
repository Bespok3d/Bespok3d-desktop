// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { setup } from '../../../test/harness'
import { IconPrinter } from '../../../design-system/icons'
import { IconBody } from './IconBody'

const COLOR = 'oklch(55% 0.14 235)'

describe('IconBody', () => {
  it('always paints the chosen colour behind an image, so a transparent picture shows it through', () => {
    const { container } = setup(<IconBody size={40} color={COLOR} image="data:image/png;base64,AAAA" DefaultIcon={IconPrinter} />)
    const body = container.querySelector('.ei-body') as HTMLElement
    expect(body.style.background).not.toBe('')
    expect(body.style.background).toContain('235')
    expect((body.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  it('shows the fallback image when the user set no picture of their own', () => {
    const { container } = setup(<IconBody size={40} color={COLOR} fallbackImage="data:image/svg+xml,<svg/>" DefaultIcon={IconPrinter} />)
    expect((container.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('data:image/svg+xml,<svg/>')
  })

  it("the user's picture wins over the fallback image", () => {
    const { container } = setup(<IconBody size={40} color={COLOR} image="data:image/png;base64,USER" fallbackImage="data:image/svg+xml,<svg/>" DefaultIcon={IconPrinter} />)
    expect((container.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('data:image/png;base64,USER')
  })

  it('renders the default glyph (no image) when neither picture nor fallback is set', () => {
    const { container } = setup(<IconBody size={40} color={COLOR} DefaultIcon={IconPrinter} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
