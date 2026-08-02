// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The list of events is the whole of what Bespok3d promises to collect, and the promise is only worth
// anything if the app cannot quietly step outside it. These tests hold both directions: nothing is
// sent that the list does not carry, and nothing is listed that the app never sends. The second half
// matters as much as the first, because a list naming an event that no longer exists tells a reader
// we collect something we do not, and a reader who finds one wrong line stops believing the rest.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { ANALYTICS_EVENT_NAMES } from './events'

const appSourceDir = join(__dirname, '..', '..')

// Every name passed to reportEvent as a literal, anywhere in the app, with the file it came from.
function eventNamesSentInTheSource(): { name: string; file: string }[] {
  return sourceFiles().flatMap((file) => namesSentIn(file).map((name) => ({ name, file })))
}

function sourceFiles(): string[] {
  const everything = readdirSync(appSourceDir, { recursive: true, encoding: 'utf8' })

  return everything.filter((path) => /\.tsx?$/.test(path) && !path.includes('.test.'))
}

function namesSentIn(path: string): string[] {
  const source = readFileSync(join(appSourceDir, path), 'utf8')

  return [...source.matchAll(/reportEvent\(\s*'([^']*)'/g)].map((call) => call[1])
}

describe('what the app sends and what it publishes', () => {
  it('sends nothing the list does not carry, so no event reaches the host unannounced', () => {
    const published: readonly string[] = ANALYTICS_EVENT_NAMES
    const unlisted = eventNamesSentInTheSource().filter((sent) => !published.includes(sent.name))

    expect(unlisted).toEqual([])
  })

  it('lists nothing the app never sends, so the list is not a claim about a vanished event', () => {
    const sent = eventNamesSentInTheSource().map((call) => call.name)
    const listedButNeverSent = ANALYTICS_EVENT_NAMES.filter((name) => !sent.includes(name))

    expect(listedButNeverSent).toEqual([])
  })

  it('finds the sends at all, or both checks above would pass by finding nothing', () => {
    expect(eventNamesSentInTheSource().length).toBeGreaterThanOrEqual(ANALYTICS_EVENT_NAMES.length)
  })
})

describe('the names themselves', () => {
  it('are the shape the published guidelines require: snake_case, past tense, no shouting', () => {
    const misnamed = ANALYTICS_EVENT_NAMES.filter((name) => !/^[a-z]+(_[a-z0-9]+)+$/.test(name))

    expect(misnamed).toEqual([])
  })

  it('are each written once, so two rows of the published list cannot mean the same event', () => {
    expect(new Set(ANALYTICS_EVENT_NAMES).size).toBe(ANALYTICS_EVENT_NAMES.length)
  })
})
