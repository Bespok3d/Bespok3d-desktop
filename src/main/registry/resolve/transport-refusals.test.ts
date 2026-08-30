// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What each of the three transports does with an answer that is not a plugin list. A host can serve
// anything with a 200 on it: a captive portal's login page, the wrong file, an error object, or a
// shape written to break the reader. Whichever way the list was asked for, the answer has to come
// back as a named refusal for THAT source, because the alternative is the one that bit: an object the
// loader then read fields off, throwing in the middle of the walk over every source, which lost the
// owner every other list he has over one bad answer.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RegistryFetchError } from '../model'
import type { RegistryRef } from '../model'
import { fetchGitHostRegistry } from './fetch'

const mocks = vi.hoisted(() => ({ isConnected: vi.fn() }))

vi.mock('./cache', () => ({ loadCache: () => new Map(), writeCache: vi.fn(), conditionalHeaders: () => ({}) }))
vi.mock('./verify', () => ({ verifyIndexSignature: () => Promise.resolve({ proof: 'unsigned' }) }))
vi.mock('../../git-host', () => ({ activeConnector: () => ({ isConnected: mocks.isConnected }) }))

const GITHUB_SCHEME = 'github:bespok3d-fixture/list-repo/index.json'
const RELEASE_ASSET = 'https://github.com/bespok3d-fixture/list-repo/releases/latest/download/index.json'
const PLAIN_HTTP = 'https://lists.example.invalid/index.json'

const HOSTILE_ANSWERS = {
  'a login page where the list should be': '<html><body>Sign in to the hotel wifi</body></html>',
  'an error object served with a 200 on it': '{"error":"not today"}',
  'a list whose plugins are not a list': '{"schema_version":1,"name":"Fixture List","plugins":"everything"}',
  'a bare array': '[]',
}

function everyUrlAnswers(bytes: string): void {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(bytes), headers: new Headers() })))
}

function listAt(url: string): RegistryRef {
  return { url, trust: 'community', locked: false }
}

async function refusalFrom(url: string): Promise<unknown> {
  return fetchGitHostRegistry(listAt(url)).then(() => null, (error: unknown) => error)
}

beforeEach(() => {
  vi.clearAllMocks()
  // No token to fall back on, so what the anonymous read found is what the owner is told.
  mocks.isConnected.mockResolvedValue(false)
})

afterEach(() => vi.unstubAllGlobals())

describe('a source that answers with something that is not a plugin list', () => {
  const transports = { 'the github scheme': GITHUB_SCHEME, 'a release asset': RELEASE_ASSET, 'plain http': PLAIN_HTTP }

  Object.entries(transports).forEach(([transport, url]) => {
    Object.entries(HOSTILE_ANSWERS).forEach(([answer, bytes]) => {
      it(`refuses ${answer} read over ${transport}`, async () => {
        everyUrlAnswers(bytes)
        const refusal = await refusalFrom(url)
        expect(refusal).toBeInstanceOf(RegistryFetchError)
      })
    })
  })

  it('says which source is at fault and not that the machine is offline', async () => {
    everyUrlAnswers(HOSTILE_ANSWERS['a list whose plugins are not a list'])
    const refusal = await refusalFrom(PLAIN_HTTP) as RegistryFetchError
    expect(refusal.reason).toBe('empty')
    expect(refusal.message).toMatch(/no plugins in it/)
  })

  it('still loads a real list served the same way', async () => {
    everyUrlAnswers(JSON.stringify({ schema_version: 1, name: 'Fixture List', publisher: 'PLACEHOLDER', updated: '2026-01-01', plugins: [] }))
    const fetched = await fetchGitHostRegistry(listAt(PLAIN_HTTP))
    expect(fetched.index.name).toBe('Fixture List')
  })
})
