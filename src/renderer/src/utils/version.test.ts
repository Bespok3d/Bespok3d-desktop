// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { versionLabel } from './version'

// A stand-in for the real i18n t(): renders only the one key versionLabel uses, so the assertion reads
// the exact string a user sees rather than a token.
function fakeT(key: string, params?: Record<string, string | number>): string {
  if (key === 'store.plugin_version_note') return `(plugin v${params?.version})`

  return key
}

describe('versionLabel', () => {
  it('leads with the packaged upstream version and keeps the plugin version in brackets', () => {
    expect(versionLabel(fakeT, '0.1.4', '1.37.2')).toBe('v1.37.2 (plugin v0.1.4)')
  })

  it('shows only the plugin version when the plugin wraps nothing (no sw_version)', () => {
    expect(versionLabel(fakeT, '0.1.4')).toBe('v0.1.4')
    expect(versionLabel(fakeT, '0.1.4', undefined)).toBe('v0.1.4')
  })
})
