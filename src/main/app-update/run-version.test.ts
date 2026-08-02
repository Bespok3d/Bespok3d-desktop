// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What separates an update from a first run. Getting this wrong in the counting-it-as-an-update
// direction would show a wave of updates on the day a version ships that were really new installs,
// which is the one number this project cannot afford to be wrong about.
import { describe, it, expect, vi, beforeEach } from 'vitest'

var runningVersion = '0.5.0'
var storedVersion: string | undefined

vi.mock('electron', () => ({ app: { getVersion: () => runningVersion, getPath: () => '' }, shell: { openPath: vi.fn() } }))
vi.mock('electron-updater', () => ({ autoUpdater: { on: vi.fn(), removeAllListeners: vi.fn() } }))
vi.mock('../settings', () => ({
  loadSettings: () => ({ lastRunVersion: storedVersion }),
  saveSettings: (patch: { lastRunVersion?: string }) => {
    storedVersion = patch.lastRunVersion

    return {}
  },
}))
vi.mock('../analytics', () => ({ reportEvent: vi.fn() }))

import { recordRunVersion, consumeAppliedUpdate } from './index'
import { reportEvent } from '../analytics'

const reported = vi.mocked(reportEvent)

beforeEach(() => {
  reported.mockClear()
  consumeAppliedUpdate()
  runningVersion = '0.5.0'
  storedVersion = undefined
})

describe('a version that changed since the last run', () => {
  it('is not reported on a brand-new install, which has never run any version', () => {
    recordRunVersion()

    expect(reported).not.toHaveBeenCalled()
    expect(storedVersion).toBe('0.5.0')
  })

  it('is not reported when the same version runs again', () => {
    storedVersion = '0.5.0'
    recordRunVersion()

    expect(reported).not.toHaveBeenCalled()
  })

  it('is reported carrying the version the app came from, so the jump is readable', () => {
    storedVersion = '0.4.2'
    recordRunVersion()

    expect(reported).toHaveBeenCalledWith('app_updated', { previous_version: '0.4.2' })
  })

  it('is reported once, not again on the next start of the same version', () => {
    storedVersion = '0.4.2'
    recordRunVersion()
    recordRunVersion()

    expect(reported).toHaveBeenCalledTimes(1)
  })

  it('still tells the user what they are now running, so the event did not replace the confirmation', () => {
    storedVersion = '0.4.2'
    recordRunVersion()

    expect(consumeAppliedUpdate()).toBe('0.5.0')
  })
})
