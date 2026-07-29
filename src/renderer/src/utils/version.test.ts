// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { isDaemonVersionAtLeast, isNewerVersion, versionLabel } from './version'

// A stand-in for the real i18n t(): renders only the one key versionLabel uses, so the assertion reads
// the exact string a user sees rather than a token.
function fakeT(key: string, params?: Record<string, string | number>): string {
  if (key === 'store.plugin_version_note') return `(plugin v${params?.version})`

  return key
}

describe('isDaemonVersionAtLeast', () => {
  it('treats equal versions as satisfied', () => {
    expect(isDaemonVersionAtLeast('0.9.0-dev', '0.9.0-dev')).toBe(true)
  })

  it('compares minor versions numerically, not lexically', () => {
    expect(isDaemonVersionAtLeast('0.10.0-dev', '0.9.0-dev')).toBe(true)
    expect(isDaemonVersionAtLeast('0.9.0-dev', '0.10.0-dev')).toBe(false)
  })

  it('flags an older daemon as not satisfying the requirement', () => {
    expect(isDaemonVersionAtLeast('0.7.0-dev', '0.9.0-dev')).toBe(false)
  })

  it('ignores the prerelease suffix', () => {
    expect(isDaemonVersionAtLeast('1.0.0', '1.0.0-dev')).toBe(true)
    expect(isDaemonVersionAtLeast('1.0.0-dev', '1.0.0')).toBe(true)
  })

  it('treats an unknown (0.0.0) daemon as below any real requirement', () => {
    expect(isDaemonVersionAtLeast('0.0.0', '0.9.0-dev')).toBe(false)
  })
})

describe('isNewerVersion', () => {
  it('is true only when the candidate is strictly newer', () => {
    expect(isNewerVersion('0.1.1', '0.1.0')).toBe(true)
    expect(isNewerVersion('0.2.0', '0.1.9')).toBe(true)
  })

  it('is false for an equal or older candidate (no downgrade-as-update)', () => {
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false)
    expect(isNewerVersion('0.1.0', '0.1.2')).toBe(false)
  })

  it('treats a dev build-tag as the same release (no phantom update)', () => {
    expect(isNewerVersion('0.1.6+dev.3a7f1c2', '0.1.6')).toBe(false)
    expect(isNewerVersion('0.1.6', '0.1.6+dev.3a7f1c2')).toBe(false)
    expect(isNewerVersion('0.1.6+dev.9b04c01', '0.1.6+dev.3a7f1c2')).toBe(false)
    expect(isNewerVersion('0.2.0-experiment+dev.9b04c01', '0.2.0-experiment+dev.3a7f1c2')).toBe(false)
  })
})

describe('versionLabel', () => {
  it('leads with the packaged upstream version and keeps the plugin version in brackets', () => {
    expect(versionLabel(fakeT, '0.1.4', '1.37.2')).toBe('v1.37.2 (plugin v0.1.4)')
  })

  it('shows only the plugin version when the plugin wraps nothing (no sw_version)', () => {
    expect(versionLabel(fakeT, '0.1.4')).toBe('v0.1.4')
    expect(versionLabel(fakeT, '0.1.4', undefined)).toBe('v0.1.4')
  })
})
