// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// These tests hold the promises the consent copy makes to the user. Each one is a sentence a person
// could read and check for themselves: nothing goes out before you answer, nothing goes out if you
// say no, switching off stops it inside the same run, and no event carries anything that tells this
// install from any other one.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const userDataDir = mkdtempSync(join(tmpdir(), 'b3-analytics-'))
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }))

import { reportEvent, startAnalytics } from './index'
import { setAnalyticsConsent } from './consent'
import { clientId, saveSettings } from '../settings'

const settingsFile = join(userDataDir, 'settings.json')
const RUNNING_BUILD = {
  projectToken: 'test-project-token',
  appVersion: '9.9.9',
  countThisRun: true,
  releaseRun: true,
  systemLanguage: 'en-GB',
}
const sentToIngest = vi.fn()

// The reporter never blocks its caller, so an assertion has to let the send it started reach the stub
// before it looks. One microtask is enough: nothing here waits on a real network.
function settle(): Promise<void> {
  return Promise.resolve()
}

beforeEach(() => {
  if (existsSync(settingsFile)) chmodSync(settingsFile, 0o600)
  rmSync(settingsFile, { force: true })
  sentToIngest.mockReset()
  sentToIngest.mockResolvedValue({ ok: true, status: 200 })
  vi.stubGlobal('fetch', sentToIngest)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  startAnalytics(RUNNING_BUILD)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the consent gate', () => {
  it('sends nothing, and keeps nothing to send later, before the user has been asked', async () => {
    reportEvent('app_launched', {})
    await settle()

    expect(sentToIngest).not.toHaveBeenCalled()
    expect(existsSync(settingsFile)).toBe(false)
  })

  it('sends nothing when the user has said no', async () => {
    setAnalyticsConsent(false)
    reportEvent('app_launched', {})
    await settle()

    expect(sentToIngest).not.toHaveBeenCalled()
  })

  it('sends to the recorder host, carrying the app version, once the user has said yes', async () => {
    setAnalyticsConsent(true)
    reportEvent('app_updated', { previous_version: '9.9.8' })
    await settle()

    const [url, request] = sentToIngest.mock.calls[0]
    expect(url).toBe('https://recorder.bespok3d.app/i/v0/e/')
    expect(JSON.parse(request.body)).toMatchObject({
      event: 'app_updated',
      api_key: 'test-project-token',
      properties: { previous_version: '9.9.8', app_version: '9.9.9' },
    })
  })

  it('stops sending the moment the user switches it off, inside the same run', async () => {
    setAnalyticsConsent(true)
    reportEvent('app_launched', {})
    setAnalyticsConsent(false)
    reportEvent('printer_enrolled', {})
    await settle()

    expect(sentToIngest).toHaveBeenCalledTimes(1)
  })
})

// Nothing is queued anywhere, so a later yes has no backlog to flush. That is a promise about the
// disk, not about the network, and only a look at the disk can hold it.
describe('what is never kept for later', () => {
  it('holds nothing back on disk while the answer is no', async () => {
    setAnalyticsConsent(false)
    reportEvent('app_launched', {})
    await settle()

    expect(readdirSync(userDataDir)).toEqual(['settings.json'])
    expect(readFileSync(settingsFile, 'utf-8')).not.toContain('app_launched')
  })

  it('holds nothing back on disk before the user has been asked either', async () => {
    reportEvent('app_launched', {})
    await settle()

    expect(readdirSync(userDataDir)).toEqual([])
  })
})

// The host insists every event name a sender. What it is told is one word, shared by every install,
// so the field it keeps forever separates nobody from anybody.
describe('who the events say they are from', () => {
  function sendersOfEverySentEvent(): string[] {
    return sentToIngest.mock.calls.map((call) => JSON.parse(call[1].body).distinct_id)
  }

  it('names the same sender on every event, whatever the event is', async () => {
    setAnalyticsConsent(true)
    reportEvent('app_launched', {})
    reportEvent('printer_enrolled', {})
    reportEvent('app_updated', { previous_version: '9.9.8' })
    reportEvent('error_occurred', { error_class: 'TypeError', area: 'renderer' })
    await settle()

    expect(sendersOfEverySentEvent()).toEqual(['bespok3d', 'bespok3d', 'bespok3d', 'bespok3d'])
  })

  it('says a run from a working copy is one, so the project is never counted as its own users', async () => {
    startAnalytics({ ...RUNNING_BUILD, releaseRun: false })
    setAnalyticsConsent(true)
    reportEvent('app_launched', {})
    await settle()

    expect(sendersOfEverySentEvent()).toEqual(['bespok3d-dev'])
  })

  // R-TEST-5. clientId is what this computer calls itself to a printer at enrollment. Nothing on the
  // wire may be it, or anything else this machine could be recognised by later.
  it('never puts the name a printer knows this machine by on the wire', async () => {
    const printerFacingId = clientId()
    setAnalyticsConsent(true)
    reportEvent('app_launched', {})
    await settle()

    expect(sentToIngest.mock.calls[0][1].body).not.toContain(printerFacingId)
  })
})

// Without this the host would open a record keyed by that one word and hang properties on it, which
// is a store about a person the app has told the user it does not keep.
describe('what the host is told not to keep', () => {
  it('tells the host not to build a profile, on every event', async () => {
    setAnalyticsConsent(true)
    reportEvent('app_launched', {})
    reportEvent('plugin_installed', {})
    await settle()

    const profileFlags = sentToIngest.mock.calls.map(
      (call) => JSON.parse(call[1].body).properties.$process_person_profile,
    )
    expect(profileFlags).toEqual([false, false])
  })

  // The other keys in this file are the user's own settings. The point is that reporting adds nothing
  // of its own beside the answer: no id, no counter, nothing that would survive to a later run.
  it('keeps nothing of its own on disk but the answer itself', () => {
    setAnalyticsConsent(true)
    reportEvent('app_launched', {})

    const stored = Object.keys(JSON.parse(readFileSync(settingsFile, 'utf-8')))

    expect(stored.filter((key) => key.startsWith('analytics'))).toEqual(['analyticsConsent'])
  })
})

// A phone app one day would send its own word for itself from its own code, and these numbers would
// separate without either side changing. None of the three tells two machines apart.
describe('what kind of copy sent it', () => {
  function propertiesOfFirstEvent(): Record<string, unknown> {
    return JSON.parse(sentToIngest.mock.calls[0][1].body).properties
  }

  it('carries the client, the operating system and the language on every event', async () => {
    setAnalyticsConsent(true)
    reportEvent('app_launched', {})
    await settle()

    expect(propertiesOfFirstEvent()).toMatchObject({
      client: 'desktop',
      os: expect.stringMatching(/^(macos|windows|linux)$/),
      language: 'en-GB',
    })
  })

  it('reports the language the user chose, not the machine one, once they have chosen', async () => {
    setAnalyticsConsent(true)
    saveSettings({ uiLocale: 'ja' })
    reportEvent('app_launched', {})
    await settle()

    expect(propertiesOfFirstEvent()).toMatchObject({ language: 'ja' })
  })
})

describe('the build', () => {
  it('sends nothing when no project key was built in, however willing the user is', async () => {
    startAnalytics({ ...RUNNING_BUILD, projectToken: '' })
    setAnalyticsConsent(true)
    reportEvent('app_launched', {})
    await settle()

    expect(sentToIngest).not.toHaveBeenCalled()
  })

  it('sends nothing from an automated run, whose events would be a harness measuring itself', async () => {
    startAnalytics({ ...RUNNING_BUILD, countThisRun: false })
    setAnalyticsConsent(true)
    reportEvent('app_launched', {})
    await settle()

    expect(sentToIngest).not.toHaveBeenCalled()
  })

  it('sends nothing at all until the app has started reporting', async () => {
    vi.resetModules()
    const neverStarted = await import('./index')
    setAnalyticsConsent(true)
    neverStarted.reportEvent('app_launched', {})
    await settle()

    expect(sentToIngest).not.toHaveBeenCalled()
  })
})

describe('a fault in reporting', () => {
  it('never reaches the caller when the analytics host refuses the event', async () => {
    sentToIngest.mockResolvedValue({ ok: false, status: 503 })
    setAnalyticsConsent(true)

    expect(() => reportEvent('plugin_installed', {})).not.toThrow()
    await settle()
    await settle()
  })

  it('never reaches the caller when the network throws outright', async () => {
    sentToIngest.mockImplementation(() => {
      throw new Error('no route to host')
    })
    setAnalyticsConsent(true)

    expect(() => reportEvent('plugin_installed', {})).not.toThrow()
    await settle()
  })

  // Running as root defeats the permission bits this test relies on. Reporting has nothing to write,
  // so a read-only settings file costs the user neither a crash nor the reporting they agreed to.
  it.skipIf(process.getuid?.() === 0)('reports as usual when the settings file cannot be written', async () => {
    writeFileSync(settingsFile, JSON.stringify({ analyticsConsent: 'granted' }))
    chmodSync(settingsFile, 0o400)

    expect(() => reportEvent('app_launched', {})).not.toThrow()
    await settle()
    expect(sentToIngest).toHaveBeenCalledTimes(1)
  })
})

describe('the event taxonomy', () => {
  it('refuses a property the event does not declare', () => {
    setAnalyticsConsent(true)
    // @ts-expect-error printer_model is not a declared property of printer_enrolled, and the compiler
    // is what enforces it: this line failing to error means the allowlist has stopped holding.
    reportEvent('printer_enrolled', { printer_model: 'U1' })
  })

  it('refuses a name that is not on the published list, however it got as far as the sender', async () => {
    setAnalyticsConsent(true)
    // Cast because the compiler already refuses this at a typed call site. What is being checked is
    // the other way in: a name reaching the sender from code the compiler never saw.
    reportEvent('printer_photo_taken' as 'printer_enrolled', {})
    await settle()

    expect(sentToIngest).not.toHaveBeenCalled()
  })
})
