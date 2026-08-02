// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The document at the other end of this check is what a user reads to find out what Bespok3d
// collects. The app's own list is what it actually sends. Nobody reads both, so the only thing that
// can keep them the same is a check that goes red when they differ: a row for an event we stopped
// sending tells a reader we collect something we do not, and a send with no row is a collection
// nobody was told about. The document lives in the server repo, which carries no test runner of its
// own, so the check runs here and stands down where that repo is not checked out beside this one.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { ANALYTICS_EVENT_NAMES } from './events'

const workspaceRoot = join(__dirname, '..', '..', '..', '..')
const publishedListPath = join(
  workspaceRoot,
  'support assets',
  'bespok3d-server',
  'stacks',
  'posthog',
  'INSTRUMENTATION.md',
)

const WORDS_MEANING_UNFINISHED = ['replace_me', 'replaceme', 'placeholder', 'changeme', 'change_me']

// A taxonomy row opens with the event name in backticks. Nothing else in the document does.
function namesInTheTaxonomyTable(document: string): string[] {
  const taxonomy = document.slice(document.indexOf('## Event taxonomy'))

  return [...taxonomy.matchAll(/^\|\s*`([a-z0-9_]+)`\s*\|/gm)].map((row) => row[1])
}

describe.skipIf(!existsSync(publishedListPath))('the list users read and the list the app sends', () => {
  const published = readFileSync(publishedListPath, 'utf8')
  const listed = namesInTheTaxonomyTable(published)

  it('has a row for every event, so nothing is collected that nobody was told about', () => {
    const sentButNotPublished = ANALYTICS_EVENT_NAMES.filter((name) => !listed.includes(name))

    expect(sentButNotPublished).toEqual([])
  })

  it('has no row the app never sends, so no row is a claim about a vanished event', () => {
    const sending: readonly string[] = ANALYTICS_EVENT_NAMES
    const publishedButNeverSent = listed.filter((name) => !sending.includes(name))

    expect(publishedButNeverSent).toEqual([])
  })

  it('is read at all, or both checks above would pass by comparing two empty lists', () => {
    expect(listed.length).toBe(ANALYTICS_EVENT_NAMES.length)
  })

  it('carries no stand-in somebody meant to come back and fill in', () => {
    const unfinished = WORDS_MEANING_UNFINISHED.filter((word) => published.toLowerCase().includes(word))

    expect(unfinished).toEqual([])
  })
})
