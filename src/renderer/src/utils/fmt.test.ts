// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { fmtCount } from './fmt'

describe('fmtCount', () => {
  it('returns the raw number as string below 1000', () => {
    expect(fmtCount(0)).toBe('0')
    expect(fmtCount(1)).toBe('1')
    expect(fmtCount(999)).toBe('999')
  })

  it('formats 1000-9999 with one decimal and k suffix', () => {
    expect(fmtCount(1000)).toBe('1.0k')
    expect(fmtCount(1500)).toBe('1.5k')
    expect(fmtCount(8920)).toBe('8.9k')
  })

  it('formats 10000+ with no decimal and k suffix', () => {
    expect(fmtCount(10000)).toBe('10k')
    expect(fmtCount(12480)).toBe('12k')
    expect(fmtCount(100000)).toBe('100k')
  })
})
