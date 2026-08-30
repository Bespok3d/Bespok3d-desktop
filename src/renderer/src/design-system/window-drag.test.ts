// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

// The frameless window is moved by dragging the header, the one element carrying -webkit-app-region: drag.
// Chromium builds the drag region from element order, NOT from z-index, so ANY later rule that paints a
// no-drag rectangle over the header (a full-window scrim is the classic one) erases the header's rectangle
// and the window can no longer be moved while that overlay is mounted. Only the header's own interactive
// children may opt out of drag, and they sit inside the header so they subtract nothing else.
const RENDERER_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function stylesheetPaths(): string[] {
  return readdirSync(RENDERER_ROOT, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.css'))
    .map((entry) => join(RENDERER_ROOT, entry))
}

function selectorsOptingOutOfDrag(stylesheetPath: string): string[] {
  const selectors: string[] = []
  postcss.parse(readFileSync(stylesheetPath, 'utf8')).walkRules((rule) => {
    rule.walkDecls('-webkit-app-region', (declaration) => {
      if (declaration.value.trim() !== 'no-drag') return
      selectors.push(rule.selector)
    })
  })

  return selectors
}

function isHeaderChild(selector: string): boolean {
  return selector.split(',').every((part) => part.trim().startsWith('.header '))
}

describe('window drag region', () => {
  const optOuts = stylesheetPaths().flatMap(selectorsOptingOutOfDrag)

  it('only children of the header opt out of drag, so nothing erases the header drag region', () => {
    expect(optOuts.filter((selector) => !isHeaderChild(selector))).toEqual([])
  })

  it('the header still declares the drag region the window is moved by', () => {
    const headerCss = readFileSync(join(RENDERER_ROOT, 'design-system/app.css'), 'utf8')
    expect(headerCss).toMatch(/\.header\s*\{[^}]*-webkit-app-region:\s*drag/s)
  })
})
