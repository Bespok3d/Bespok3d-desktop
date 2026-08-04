// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

// Scrollbars, dropdown lists and form controls are painted by the platform, not by our tokens. Without
// `color-scheme` the dark theme gets a light scrollbar down the side of every scrolling panel, which is
// exactly what was reported. The token swap alone cannot fix it, so both themes must declare theirs.

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = readFileSync(join(HERE, 'tokens.css'), 'utf8')

function colorSchemeForSelector(selector: string): string | null {
  var declared: string | null = null
  postcss.parse(TOKENS_CSS).walkRules((rule) => {
    const matchesSelector = rule.selector.split(',').some((part) => part.trim() === selector)
    if (!matchesSelector) return
    rule.walkDecls('color-scheme', (decl) => { declared = decl.value.trim() })
  })

  return declared
}

describe('color-scheme', () => {
  it('tells the platform the light theme is light', () => {
    expect(colorSchemeForSelector(':root')).toBe('light')
  })

  it('tells the platform the dark theme is dark, so native scrollbars are dark too', () => {
    expect(colorSchemeForSelector("[data-theme='dark']")).toBe('dark')
  })
})
