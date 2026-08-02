// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Who gets asked, and who is left alone. The question is asked once in the life of an install, and
// only on a run whose answer would change anything: an unattended run is never asked, so a machine
// with nobody in front of it still gets to the end of what it was doing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const userDataDir = mkdtempSync(join(tmpdir(), 'b3-consent-'))
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }))

import { usageReportingConsent } from './consent'
import { startAnalytics } from './index'
import { setAnalyticsConsent } from './consent'

const settingsFile = join(userDataDir, 'settings.json')
const RUNNING_BUILD = {
  projectToken: 'test-project-token',
  appVersion: '9.9.9',
  countThisRun: true,
  releaseRun: true,
  systemLanguage: 'en-GB',
}

beforeEach(() => {
  if (existsSync(settingsFile)) chmodSync(settingsFile, 0o600)
  rmSync(settingsFile, { force: true })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  startAnalytics(RUNNING_BUILD)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('who is asked', () => {
  it('asks an install that has never answered, which is what an update into this version is', () => {
    expect(usageReportingConsent()).toEqual({ answer: null, ask: true })
  })

  it('never asks a second time after a no, because an app that keeps asking is wearing you down', () => {
    setAnalyticsConsent(false)

    expect(usageReportingConsent()).toEqual({ answer: 'refused', ask: false })
  })

  it('never asks again after a yes either', () => {
    setAnalyticsConsent(true)

    expect(usageReportingConsent()).toEqual({ answer: 'granted', ask: false })
  })

  it('leaves a run that is not being counted alone, so an unattended run finishes by itself', () => {
    startAnalytics({ ...RUNNING_BUILD, countThisRun: false })

    expect(usageReportingConsent()).toEqual({ answer: null, ask: false })
  })

  it('leaves a build with no project key alone, because the answer would change nothing', () => {
    startAnalytics({ ...RUNNING_BUILD, projectToken: '' })

    expect(usageReportingConsent()).toEqual({ answer: null, ask: false })
  })
})

describe('the answer the window sends back', () => {
  const mainIpc = readFileSync(join(__dirname, '../ipc.ts'), 'utf-8')

  it('is written through the analytics code that reads it, not through the general settings door', () => {
    expect(mainIpc).toContain("ipcMain.handle('analytics:setConsent'")
    expect(mainIpc).toContain('setAnalyticsConsent(granted)')
  })

  it('can be read back by the window, or neither surface could show the state it is in', () => {
    expect(mainIpc).toContain("ipcMain.handle('analytics:consent'")
  })

  // Nothing to start over from: offering it would tell the user the app holds something that follows
  // them, and the channel existing at all is how that offer would come back.
  it('offers no way to start a new id, because no id is ever made', () => {
    expect(mainIpc).not.toContain('resetIdentity')
  })
})
