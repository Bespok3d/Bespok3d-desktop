// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { formatDateTime, formatElapsedHoursMinutes } from './datetime'

const ONE_MINUTE_MS = 60_000

describe('how old the plugin listing is, as the install offer states it', () => {
  it('reads hours and minutes, both padded, so the sentence never changes width', () => {
    expect(formatElapsedHoursMinutes(185 * ONE_MINUTE_MS)).toBe('03:05')
    expect(formatElapsedHoursMinutes(9 * ONE_MINUTE_MS)).toBe('00:09')
  })

  it('keeps counting past a day rather than wrapping to zero', () => {
    expect(formatElapsedHoursMinutes(30 * 60 * ONE_MINUTE_MS)).toBe('30:00')
  })

  it('reads 00:00 for a clock that has run backwards, never a negative age', () => {
    expect(formatElapsedHoursMinutes(-5 * ONE_MINUTE_MS)).toBe('00:00')
  })
})

describe('formatDateTime', () => {
  it('renders an ISO timestamp as a localized date with a minute-precision time', () => {
    const shown = formatDateTime('2026-06-23T09:30:00Z')
    expect(shown).toContain('2026')
    expect(shown).toMatch(/\d{1,2}:\d{2}/)
  })
})
