// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const userDataDir = mkdtempSync(join(tmpdir(), 'b3-settings-'))
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }))

import { loadSettings, saveSettings, setSourceEnabled, setChannelEnabled } from './settings'

const OFFICIAL = 'github:Bespok3d/main-index/index.json'
const OTHER = 'github:other/repo/index.json'

beforeEach(() => {
  rmSync(join(userDataDir, 'settings.json'), { force: true })
})

describe('setSourceEnabled', () => {
  it('switches a source off then back on, returning disabledSources to the baseline', () => {
    setSourceEnabled(OTHER, false)
    expect(loadSettings().disabledSources).toEqual([OTHER])
    setSourceEnabled(OTHER, true)
    expect(loadSettings().disabledSources ?? []).toEqual([])
  })

  it('accumulates independent disables so toggling one never drops the other', () => {
    setSourceEnabled(OFFICIAL, false)
    setSourceEnabled(OTHER, false)
    expect(loadSettings().disabledSources).toEqual([OFFICIAL, OTHER])
    setSourceEnabled(OFFICIAL, true)
    expect(loadSettings().disabledSources).toEqual([OTHER])
  })

  it('is idempotent when a source is disabled twice (no duplicate entry)', () => {
    setSourceEnabled(OTHER, false)
    setSourceEnabled(OTHER, false)
    expect(loadSettings().disabledSources).toEqual([OTHER])
  })

  it('re-enabling a source that was never disabled is a no-op', () => {
    setSourceEnabled(OTHER, true)
    expect(loadSettings().disabledSources ?? []).toEqual([])
  })

  // The cache-reuse cycle (registry-cache.json keyed by url) relies on a toggle leaving every OTHER
  // setting untouched: re-enabling restores the exact prior disabledSources set, so loadCatalog
  // resolves the same url and the url-keyed HTTP cache still applies. Pin that a toggle is surgical.
  it('preserves unrelated settings across a source toggle', () => {
    saveSettings({ primaryReleaseChannel: 'rc', pgpEnabled: true })
    setSourceEnabled(OTHER, false)
    const after = loadSettings()
    expect(after.primaryReleaseChannel).toBe('rc')
    expect(after.pgpEnabled).toBe(true)
    setSourceEnabled(OTHER, true)
    const restored = loadSettings()
    expect(restored.primaryReleaseChannel).toBe('rc')
    expect(restored.pgpEnabled).toBe(true)
  })
})

describe('setChannelEnabled', () => {
  it('switches a channel off then back on, returning disabledChannels to the baseline', () => {
    setChannelEnabled('experiment', false)
    expect(loadSettings().disabledChannels).toEqual(['experiment'])
    setChannelEnabled('experiment', true)
    expect(loadSettings().disabledChannels ?? []).toEqual([])
  })

  it('accumulates independent channel opt-outs without dropping the other', () => {
    setChannelEnabled('experiment', false)
    setChannelEnabled('testing', false)
    expect(loadSettings().disabledChannels).toEqual(['experiment', 'testing'])
    setChannelEnabled('experiment', true)
    expect(loadSettings().disabledChannels).toEqual(['testing'])
  })

  it('leaves the primary channel scalar untouched when a channel is toggled', () => {
    saveSettings({ primaryReleaseChannel: 'lts' })
    setChannelEnabled('experiment', false)
    expect(loadSettings().primaryReleaseChannel).toBe('lts')
  })
})
