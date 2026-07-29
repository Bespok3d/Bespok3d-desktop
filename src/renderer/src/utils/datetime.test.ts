// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { formatDateTime } from './datetime'

describe('formatDateTime', () => {
  it('renders an ISO timestamp as a localized date with a minute-precision time', () => {
    const shown = formatDateTime('2026-06-23T09:30:00Z')
    expect(shown).toContain('2026')
    expect(shown).toMatch(/\d{1,2}:\d{2}/)
  })
})
