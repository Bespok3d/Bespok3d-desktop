// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Updating the app is nobody's account business: an account is asked for to publish a plugin and for
// nothing else. Two ways that promise gets broken quietly, so both are asserted on the sources rather
// than on a mock: reading releases through the account's connector (which signs the call and dies with
// a 404 on a private repo when signed out), and spending the anonymous request allowance on the api
// when the same answer is served from the cdn for free.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const UPDATE_SOURCES = readdirSync(__dirname)
  .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))

function sourceOf(fileName: string): string {
  return readFileSync(join(__dirname, fileName), 'utf8')
}

function filesMatching(pattern: RegExp): string[] {
  return UPDATE_SOURCES.filter((fileName) => pattern.test(sourceOf(fileName)))
}

describe('what the update path asks for', () => {
  it('has sources to check', () => {
    expect(UPDATE_SOURCES.length).toBeGreaterThan(0)
  })

  it('never calls the rationed api host', () => {
    expect(filesMatching(/api\.github\.com/)).toEqual([])
  })

  // The bug this replaces: signed out, the Update pane answered with a 404 from the account api.
  // A `import type` of the shared release shape stays welcome: a shape carries no credentials.
  it('never reads releases through the signed-in account', () => {
    expect(filesMatching(/import (?!type )[^;]*from '\.\.\/git-host/)).toEqual([])
    expect(filesMatching(/activeConnector|keychain/)).toEqual([])
  })

  it('takes the release list from the public feed', () => {
    expect(sourceOf('public-releases.ts')).toContain('releases.atom')
  })
})
