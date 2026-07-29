// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { primaryAction, progressMode } from './UpdateModal'
import { shouldShowUpdateModal } from './useAppUpdate'

const autoInstall = { action: 'autoInstall' as const, releaseUrl: 'https://example/releases/v1' }
const manual = { action: 'openDownload' as const, releaseUrl: 'https://example/releases/v1' }

describe('primaryAction', () => {
  it('offers restart once downloaded', () => {
    expect(primaryAction(autoInstall, true, true, null, false)).toBe('restart')
  })
  it('offers a download button before the user starts', () => {
    expect(primaryAction(autoInstall, false, false, null, false)).toBe('download')
  })
  it('shows downloading once the user has requested it', () => {
    expect(primaryAction(autoInstall, false, true, null, false)).toBe('downloading')
  })
  it('falls back to the release page on error or stall when a url exists', () => {
    expect(primaryAction(autoInstall, false, true, 'boom', false)).toBe('openDownload')
    expect(primaryAction(autoInstall, false, true, null, true)).toBe('openDownload')
  })
  it('always opens the page on a manual-only platform', () => {
    expect(primaryAction(manual, false, false, null, false)).toBe('openDownload')
  })
})

describe('progressMode', () => {
  it('shows nothing until a download is requested', () => {
    expect(progressMode(false, false, null, false, null)).toBe('none')
  })
  it('is indeterminate while requested with no percentage yet (macOS reports none)', () => {
    expect(progressMode(true, false, null, false, null)).toBe('indeterminate')
  })
  it('becomes determinate once a percentage arrives', () => {
    expect(progressMode(true, false, null, false, 42)).toBe('determinate')
  })
  it('shows nothing when downloaded, errored, or stalled', () => {
    expect(progressMode(true, true, null, false, 50)).toBe('none')
    expect(progressMode(true, false, 'boom', false, 50)).toBe('none')
    expect(progressMode(true, false, null, true, 100)).toBe('none')
  })
})

describe('shouldShowUpdateModal', () => {
  const payload = { version: '1', action: 'autoInstall', releaseNotesMarkdown: '', autoDownload: true } as UpdateAvailablePayload
  it('hides during a silent auto-download', () => {
    expect(shouldShowUpdateModal({ update: payload, downloaded: false, errorMessage: null })).toBe(false)
  })
  it('shows once the update is downloaded', () => {
    expect(shouldShowUpdateModal({ update: payload, downloaded: true, errorMessage: null })).toBe(true)
  })
  it('shows on error', () => {
    expect(shouldShowUpdateModal({ update: payload, downloaded: false, errorMessage: 'boom' })).toBe(true)
  })
  it('shows at available-time when auto-download is off (user-initiated)', () => {
    const manualPayload = { ...payload, autoDownload: false } as UpdateAvailablePayload
    expect(shouldShowUpdateModal({ update: manualPayload, downloaded: false, errorMessage: null })).toBe(true)
  })
  it('shows nothing without an update', () => {
    expect(shouldShowUpdateModal({ update: null, downloaded: false, errorMessage: null })).toBe(false)
  })
})
