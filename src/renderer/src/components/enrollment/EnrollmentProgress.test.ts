// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { successCopy } from './EnrollmentProgress'
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
