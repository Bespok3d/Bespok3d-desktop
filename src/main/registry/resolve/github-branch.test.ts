// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A published list lives on `main`, but every Bespok3d repo's DEFAULT branch is the working branch
// `dev` - so a read that names no branch serves whatever is mid-flight in the repo. These tests pin
// the branch on every read that has a branch to name: the raw-file avenue and both authenticated
// reads, index and detached signature. The signature one is not a formality: a `.sig` appended to the
// wrong part of the url 404s silently and leaves every plugin in the list badged unverifiable.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { RegistryRef } from '../model'
import { fetchGitHostRegistry } from './fetch'

const mocks = vi.hoisted(() => ({ getFile: vi.fn(), verifyIndexSignature: vi.fn(), isConnected: vi.fn() }))

vi.mock('./cache', () => ({ loadCache: () => new Map(), writeCache: vi.fn(), conditionalHeaders: () => ({}) }))
vi.mock('./verify', () => ({ verifyIndexSignature: mocks.verifyIndexSignature }))
vi.mock('../../git-host', () => ({ activeConnector: () => ({ getFile: mocks.getFile, isConnected: mocks.isConnected }) }))

const LIST_REF: RegistryRef = { url: 'github:bespok3d-fixture/list-repo/index.json', trust: 'project', locked: true }
const RAW_PATH = 'https://raw.githubusercontent.com/bespok3d-fixture/list-repo/main/index.json'
const RELEASE_PATH = 'https://github.com/bespok3d-fixture/list-repo/releases/latest/download/index.json'
const FIXTURE_BYTES = `${JSON.stringify({ schema_version: 1, name: 'Fixture List', publisher: 'PLACEHOLDER', updated: '2026-01-01', plugins: [] })}\n`

function answeredBy(servingUrl: string): ReturnType<typeof vi.fn> {
  const fetched = vi.fn((url: string) =>
    Promise.resolve(
      url.startsWith(servingUrl)
        ? { ok: true, status: 200, text: () => Promise.resolve(FIXTURE_BYTES), headers: new Headers() }
        : { ok: false, status: 404, text: () => Promise.resolve(''), headers: new Headers() },
    ),
  )
  vi.stubGlobal('fetch', fetched)

  return fetched
}

function requestedUrls(fetched: ReturnType<typeof vi.fn>): string[] {
  return fetched.mock.calls.map((call) => String(call[0]))
}

beforeEach(() => {
  mocks.verifyIndexSignature.mockResolvedValue({ proof: 'unsigned' })
  mocks.getFile.mockResolvedValue({ content: FIXTURE_BYTES, sha: 'fixture-sha' })
  mocks.isConnected.mockResolvedValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('a GitHub list is read from main, never the repo default branch', () => {
  it('reads the raw file from main when no release publishes the list', async () => {
    const fetched = answeredBy(RAW_PATH)
    await fetchGitHostRegistry(LIST_REF)

    expect(requestedUrls(fetched)).toContain(RAW_PATH)
  })

  it('asks for the detached signature beside the raw file on main, never as a branch suffix', async () => {
    const fetched = answeredBy(RAW_PATH)
    await fetchGitHostRegistry(LIST_REF)

    expect(requestedUrls(fetched)).toContain(`${RAW_PATH}.sig`)
    expect(requestedUrls(fetched).some((url) => url.endsWith('main.sig/index.json'))).toBe(false)
  })

  it('takes the release asset before the raw file, so a published list is read as published', async () => {
    const fetched = answeredBy(RELEASE_PATH)
    await fetchGitHostRegistry(LIST_REF)

    expect(requestedUrls(fetched)).toContain(RELEASE_PATH)
    expect(requestedUrls(fetched)).not.toContain(RAW_PATH)
  })

  it('asks the connected account for both files on main when no anonymous avenue serves the list', async () => {
    answeredBy('https://nothing-serves-this')
    await fetchGitHostRegistry(LIST_REF)

    expect(mocks.getFile).toHaveBeenCalledWith({ owner: 'bespok3d-fixture', repo: 'list-repo' }, 'index.json', 'main')
    expect(mocks.getFile).toHaveBeenCalledWith({ owner: 'bespok3d-fixture', repo: 'list-repo' }, 'index.json.sig', 'main')
  })
})
