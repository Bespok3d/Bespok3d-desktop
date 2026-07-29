// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import en from './locales/en.json'

const entries = Object.entries(en as Record<string, string>)

describe('en.json copy', () => {
  const emDash = String.fromCharCode(0x2014)
  const enDash = String.fromCharCode(0x2013)
  it('contains no em-dash or en-dash (RULE ZERO)', () => {
    const offenders = entries
      .filter(([, value]) => value.includes(emDash) || value.includes(enDash))
      .map(([key]) => key)
    expect(offenders).toEqual([])
  })
})
