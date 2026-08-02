// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The promise these hold is the one the consent copy makes about crashes: we learn that something
// broke and what kind of thing it was, and we never learn anything about the person it broke for.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

vi.mock('./index', () => ({ reportEvent: vi.fn() }))

import { errorClassOf, forgetErrorCounts, reportErrorEvent, reportRenderFailure } from './errors'
import { reportEvent } from './index'

const sentEvent = vi.mocked(reportEvent)

function propertiesOfEverythingSent(): string {
  return JSON.stringify(sentEvent.mock.calls)
}

beforeEach(() => {
  vi.clearAllMocks()
  forgetErrorCounts()
})

describe('what a failure is allowed to say about the person it happened to', () => {
  it('sends the kind of failure and where it was, and no third thing', () => {
    reportErrorEvent(new TypeError('nope'), 'enrollment')

    expect(sentEvent).toHaveBeenCalledTimes(1)
    expect(sentEvent).toHaveBeenCalledWith('error_occurred', { error_class: 'TypeError', area: 'enrollment' })
  })

  it('never carries the message, even when the message is the whole story', () => {
    const tellsAll = new Error('ENOENT: /Users/someone/Documents/my printer/secret-plugin.b3 at 10.0.0.4')

    reportErrorEvent(tellsAll, 'plugin-install')

    expect(propertiesOfEverythingSent()).not.toContain('someone')
    expect(propertiesOfEverythingSent()).not.toContain('10.0.0.4')
    expect(propertiesOfEverythingSent()).not.toContain('secret-plugin')
  })

  it('still says something happened when what was thrown was not an error at all', () => {
    reportErrorEvent('/Users/someone/printers.json', 'main-process')

    expect(sentEvent).toHaveBeenCalledWith('error_occurred', { error_class: 'Error', area: 'main-process' })
  })

  it('keeps the subclass name, which is the only part worth having', () => {
    class DaemonRefusedError extends Error {}

    expect(errorClassOf(new DaemonRefusedError('printing'))).toBe('DaemonRefusedError')
  })

  it('keeps a digit that is part of the name, so two classes do not become one', () => {
    class Base64Error extends Error {}

    expect(errorClassOf(new Base64Error('bad padding'))).toBe('Base64Error')
  })
})

describe('a machine stuck in a loop', () => {
  function throwTheSameThing(times: number, area: 'renderer' | 'enrollment'): void {
    Array.from({ length: times }).forEach(() => reportErrorEvent(new RangeError('again'), area))
  }

  it('says it a few times and then stops, however many times it happens', () => {
    throwTheSameThing(500, 'enrollment')

    expect(sentEvent).toHaveBeenCalledTimes(3)
  })

  it('does not let one part of the app use up another part\'s allowance', () => {
    throwTheSameThing(500, 'enrollment')
    throwTheSameThing(500, 'renderer')

    expect(sentEvent).toHaveBeenCalledTimes(6)
  })
})

describe('what the window is allowed to report', () => {
  it('is filed under the renderer whatever the window says, because the window does not choose', () => {
    reportRenderFailure('TypeError')

    expect(sentEvent).toHaveBeenCalledWith('error_occurred', { error_class: 'TypeError', area: 'renderer' })
  })

  it('cannot smuggle anything through the class name', () => {
    reportRenderFailure('Error: /Users/someone/.ssh/id_rsa')

    expect(propertiesOfEverythingSent()).not.toContain('someone')
    expect(propertiesOfEverythingSent()).not.toContain('/')
  })

  it('cannot say nothing at all and have it counted as a mystery', () => {
    reportRenderFailure('...')

    expect(sentEvent).toHaveBeenCalledWith('error_occurred', { error_class: 'Error', area: 'renderer' })
  })
})

// R-ERR-6, read off the source rather than argued: the day the reporter reports its own failure as an
// event, a dead ingest host becomes an app sending itself into a loop.
describe('the reporter never reports itself', () => {
  const analyticsDir = join(__dirname)

  it('has no reportEvent call in the send path of any analytics module', () => {
    const senders = readdirSync(analyticsDir).filter((file) => file.endsWith('.ts') && !file.includes('.test.'))
    const offenders = senders.filter((file) => callsReportEventOnAFailure(join(analyticsDir, file)))

    expect(offenders).toEqual([])
  })

  // Long enough to cover any handler body written here (the longest is two lines) and short enough
  // not to run past the closing brace into ordinary code that is allowed to send events.
  const CHARACTERS_OF_A_HANDLER_BODY = 200

  function callsReportEventOnAFailure(path: string): boolean {
    const handlerBodies = readFileSync(path, 'utf8').split('catch').slice(1)

    return handlerBodies.some((body) => /report\w*Event\(/.test(body.slice(0, CHARACTERS_OF_A_HANDLER_BODY)))
  }
})
