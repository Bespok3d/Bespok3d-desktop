// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The two values a build has to be given from outside: the address events go to, and the token that
// lets them in. A stand-in left in either one is the worst kind of defect, because nothing goes red.
// The app starts, the user is asked, the user says yes, every event is dropped by a host that does
// not exist or refused by a token that is not real, and the owner reads an empty dashboard as "nobody
// is using it". These tests are the only thing standing between a placeholder and that reading.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const repoRoot = join(__dirname, '..', '..', '..')
const buildConfig = readFileSync(join(repoRoot, 'electron.vite.config.ts'), 'utf8')

// Words that mean "somebody meant to come back and fill this in". Matched case insensitively against
// a value, never against the surrounding prose, so a comment may still explain what a placeholder is.
const WORDS_MEANING_UNFINISHED = ['replace_me', 'replaceme', 'placeholder', 'changeme', 'change_me', 'example', 'todo', 'xxxx']

function readsAsUnfinished(value: string): boolean {
  return WORDS_MEANING_UNFINISHED.some((word) => value.toLowerCase().includes(word))
}

describe('the address events are sent to', () => {
  const ingestSource = readFileSync(join(__dirname, 'ingest.ts'), 'utf8')
  const ingestUrl = /const INGEST_URL = '([^']*)'/.exec(ingestSource)?.[1] ?? ''

  it('is written down at all, or every send in this app goes to nowhere', () => {
    expect(ingestUrl).not.toBe('')
  })

  it('is a bespok3d address over https, never a stand-in somebody meant to replace', () => {
    expect(readsAsUnfinished(ingestUrl)).toBe(false)
    expect(ingestUrl.startsWith('https://')).toBe(true)
    expect(new URL(ingestUrl).hostname.endsWith('.bespok3d.app')).toBe(true)
  })

  it('is the recorder that takes events, not the dashboard a person reads', () => {
    expect(new URL(ingestUrl).hostname).toBe('recorder.bespok3d.app')
  })
})

describe('the token that lets this build in', () => {
  it('is taken from the environment of whoever builds, never written into the repo', () => {
    expect(buildConfig).toContain('process.env.BESPOK3D_POSTHOG_PROJECT_TOKEN')
  })

  it('is empty rather than a stand-in on a machine that has none, so such a build is inert', () => {
    expect(buildConfig).toContain("process.env.BESPOK3D_POSTHOG_PROJECT_TOKEN ?? ''")
  })

  // The token a build carries is the write-only one every install is meant to have. The owner also
  // keeps a configuration key that can read and rewrite the whole project, and the two sit side by
  // side in the same shell under names one letter apart in meaning. Baking that one instead would
  // hand every person who downloads the app the ability to read the project and rewrite it, and
  // nothing about the app would look wrong: events would still arrive. This is the check that says
  // which of the two the build takes.
  it('is never the owner configuration key, which a build would hand to every user', () => {
    expect(buildConfig).not.toContain('BESPOK3D_POSTHOG_KEY')
  })
})

describe('no token ever reaches a repo', () => {
  // A PostHog project token is always this shape, so one committed anywhere is findable by shape
  // alone. `phx_` is the owner configuration key, which must never appear in a repo either.
  const SHAPE_OF_A_POSTHOG_CREDENTIAL = /ph[cx]_[A-Za-z0-9]/

  function sourceFilesUnder(directory: string): string[] {
    const everything = readdirSync(directory, { recursive: true, encoding: 'utf8' })

    return everything.filter((path) => /\.(ts|tsx|mjs|json)$/.test(path) && !path.includes('.test.'))
  }

  it('has no PostHog credential sitting in the app source', () => {
    const carrying = sourceFilesUnder(join(repoRoot, 'src')).filter((path) =>
      SHAPE_OF_A_POSTHOG_CREDENTIAL.test(readFileSync(join(repoRoot, 'src', path), 'utf8')),
    )

    expect(carrying).toEqual([])
  })

  it('has no PostHog credential in the build configuration either', () => {
    expect(SHAPE_OF_A_POSTHOG_CREDENTIAL.test(buildConfig)).toBe(false)
  })
})

// The one check that can only run where a token exists. It reads the value and never prints it: the
// assertion is on a yes or no, so a failing run says a placeholder is set, not what it is.
describe.skipIf(!process.env.BESPOK3D_POSTHOG_PROJECT_TOKEN)('a token the environment does carry', () => {
  it('is a real project token, not a word somebody left to fill in later', () => {
    const tokenInTheEnvironment = process.env.BESPOK3D_POSTHOG_PROJECT_TOKEN ?? ''

    expect(readsAsUnfinished(tokenInTheEnvironment)).toBe(false)
    expect(tokenInTheEnvironment.startsWith('phc_')).toBe(true)
  })

  // `phc_` and `phx_` differ in one character and the wrong one still reaches the host, so the shape
  // check above passing is not on its own proof the right variable was read.
  it('is not the owner configuration key sitting under the wrong name', () => {
    expect(process.env.BESPOK3D_POSTHOG_PROJECT_TOKEN).not.toBe(process.env.BESPOK3D_POSTHOG_KEY)
  })
})
