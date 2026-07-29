// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { shellQuote } from './ssh'

describe('shellQuote', () => {
  it('wraps a plain path in single quotes', () => {
    expect(shellQuote('/userdata/bespok3d/auth')).toBe("'/userdata/bespok3d/auth'")
  })

  it('keeps shell metacharacters inert inside the quotes', () => {
    expect(shellQuote('a;rm -rf / $(whoami)')).toBe("'a;rm -rf / $(whoami)'")
  })

  it('escapes an embedded single quote so it cannot break out', () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'")
  })
})
