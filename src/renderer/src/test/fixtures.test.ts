// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { makePrinter } from './fixtures'

// RFC 5737 keeps these three ranges for documentation, so no real network ever uses them.
const DOCUMENTATION_RANGES = ['192.0.2.', '198.51.100.', '203.0.113.']

function isDocumentationAddress(address: string): boolean {
  return DOCUMENTATION_RANGES.some((range) => address.startsWith(range))
}

describe('the sample printer the tests share', () => {
  it('sits at an address no real network uses', () => {
    expect(isDocumentationAddress(makePrinter().ip)).toBe(true)
  })
})
