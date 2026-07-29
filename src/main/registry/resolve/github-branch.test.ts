// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A published list lives on `main`, but every Bespok3d repo's DEFAULT branch is the working branch
// `dev` - so a contents request that names no branch serves whatever is mid-flight in the repo. These
// tests pin the branch on all four reads: the index and its detached signature, public and
// authenticated. The signature one is not a formality: `${contentsUrl}.sig` would append `.sig` to the
// ref query, 404 silently, and leave every plugin in the list badged unverifiable.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { RegistryRef } from '../model'
import { fetchGitHostRegistry } from './fetch'

const mocks = vi.hoisted(() => ({ getFile: vi.fn(), verifyIndexSignature: vi.fn() }))

vi.mock('./cache', () => ({ loadCache: () => new Map(), writeCache: vi.fn(), conditionalHeaders: () => ({}) }))
vi.mock('./verify', () => ({ verifyIndexSignature: mocks.verifyIndexSignature }))
vi.mock('../../git-host', () => ({ activeConnector: () => ({ getFile: mocks.getFile }) }))

const LIST_REF: RegistryRef = { url: 'github:bespok3d-fixture/list-repo/index.json', trust: 'project', locked: true }
const INDEX_PATH = 'https://api.github.com/repos/bespok3d-fixture/list-repo/contents/index.json'
const FIXTURE_BYTES = `${JSON.stringify({ schema_version: 1, name: 'Fixture List', publisher: 'PLACEHOLDER', updated: '2026-01-01', plugins: [] })}\n`

function stubPublicList(): ReturnType<typeof vi.fn> {
  const fetched = vi.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(FIXTURE_BYTES), headers: new Headers() }))
  vi.stubGlobal('fetch', fetched)

  return fetched
}

function requestedUrls(fetched: ReturnType<typeof vi.fn>): string[] {
  return fetched.mock.calls.map((call) => String(call[0]))
}

beforeEach(() => {
  mocks.verifyIndexSignature.mockResolvedValue({ proof: 'unsigned' })
  mocks.getFile.mockResolvedValue({ content: FIXTURE_BYTES, sha: 'fixture-sha' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('a GitHub list is read from main, never the repo default branch', () => {
  it('asks for the index on main', async () => {
    const fetched = stubPublicList()
    await fetchGitHostRegistry(LIST_REF)

    expect(requestedUrls(fetched)).toContain(`${INDEX_PATH}?ref=main`)
  })

  it('asks for the detached signature on main, at the .sig path and not a .sig ref', async () => {
    const fetched = stubPublicList()
    await fetchGitHostRegistry(LIST_REF)

    expect(requestedUrls(fetched)).toContain(`${INDEX_PATH}.sig?ref=main`)
    expect(requestedUrls(fetched).some((url) => url.endsWith('ref=main.sig'))).toBe(false)
  })

  it('asks the connected account for both files on main when the list is private', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') })))
    await fetchGitHostRegistry(LIST_REF)

    expect(mocks.getFile).toHaveBeenCalledWith({ owner: 'bespok3d-fixture', repo: 'list-repo' }, 'index.json', 'main')
    expect(mocks.getFile).toHaveBeenCalledWith({ owner: 'bespok3d-fixture', repo: 'list-repo' }, 'index.json.sig', 'main')
  })
})
