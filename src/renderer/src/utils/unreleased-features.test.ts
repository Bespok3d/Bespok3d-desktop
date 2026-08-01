// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { showsUnreleasedFeatures } from './unreleased-features'
import { installB3d } from '../test/b3d-mock'

afterEach(() => { vi.unstubAllEnvs() })

describe('showsUnreleasedFeatures', () => {
  it('shows them on a dev run', () => {
    installB3d()
    expect(showsUnreleasedFeatures()).toBe(true)
  })

  it('hides them in a build, unless B3D_DEV_FEATURES said otherwise when the app started', () => {
    vi.stubEnv('DEV', false)
    installB3d()
    expect(showsUnreleasedFeatures()).toBe(false)

    window.b3d.unreleasedFeaturesForced = true
    expect(showsUnreleasedFeatures()).toBe(true)
  })
})
