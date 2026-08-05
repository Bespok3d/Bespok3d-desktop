// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { successCopy, progressFill } from './EnrollmentProgress'
import type { EnrollMode } from './index'

describe('successCopy', () => {
  it('returns the enroll message key by default', () => {
    expect(successCopy(undefined).titleKey).toBe('enroll.success.default.title')
    expect(successCopy('enroll').titleKey).toBe('enroll.success.default.title')
  })

  it('returns an uninstall-specific message key, not the enroll key', () => {
    const copy = successCopy('uninstall')
    expect(copy.titleKey).toBe('enroll.success.uninstall.title')
    expect(copy.titleKey).not.toBe('enroll.success.default.title')
  })

  it('gives each lifecycle operation its own distinct success title key', () => {
    const modes: EnrollMode[] = ['deactivate', 'reactivate', 'repair', 'recovery', 'update-daemon']
    const titleKeys = modes.map((mode) => successCopy(mode).titleKey)
    titleKeys.forEach((titleKey) => expect(titleKey).not.toBe('enroll.success.default.title'))
    expect(new Set(titleKeys).size).toBe(titleKeys.length)
  })
})

// The bar has to look alive while a step runs. Deactivate is a handful of long steps, and counting
// only the finished ones left it sitting at zero for the whole first one, which reads as a hung app.
describe('progressFill', () => {
  it('shows the running step half done rather than an empty bar', () => {
    expect(progressFill(0, 4, true)).toBe(13)
  })

  it('counts only finished steps once nothing is running', () => {
    expect(progressFill(1, 4, false)).toBe(25)
  })

  it('reaches the end when every step is done', () => {
    expect(progressFill(4, 4, false)).toBe(100)
  })

  it('reads a step-less op as no progress rather than dividing by nothing', () => {
    expect(progressFill(0, 0, true)).toBe(0)
  })
})
