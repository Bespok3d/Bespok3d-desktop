// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

// The protocol picker and the address share one row. `.config-select` is width:100% everywhere else in
// this sheet, so inside the row it must take its own width back or it swallows the line and leaves the
// address a sliver: all protocol, no address.

const HERE = dirname(fileURLToPath(import.meta.url))
const STORE_CSS = readFileSync(join(HERE, '..', 'plugin-store.css'), 'utf8')

function declarationsFor(selector: string): Record<string, string> {
  var found: Record<string, string> = {}
  postcss.parse(STORE_CSS).walkRules((rule) => {
    if (rule.selector.trim() !== selector) return
    rule.walkDecls((decl) => { found[decl.prop] = decl.value })
  })

  return found
}

describe('the address row', () => {
  it('lets the protocol picker take only the width of its own word', () => {
    const picker = declarationsFor('.config-url .config-select')

    expect(picker.width).toBe('auto')
    expect(picker.flex).toBe('0 0 auto')
  })

  it('gives the rest of the row to the address', () => {
    const address = declarationsFor('.config-url .config-input')

    expect(address.flex).toBe('1')
    expect(address['min-width']).toBe('0')
  })
})
