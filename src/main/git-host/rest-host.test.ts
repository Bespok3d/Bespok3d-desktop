// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./keychain', () => ({ load: vi.fn(() => 'TKN'), save: vi.fn(), clear: vi.fn() }))

import { makeRestHost, type RestHostProfile, type JsonObject } from './rest-host'
import type { AssetInfo } from './connector'

function fakeProfile(overrides: Partial<RestHostProfile> = {}): RestHostProfile {
  return {
    label: 'Fake',
    keychainKey: 'fake-token',
    apiBase: 'https://api.fake.test',
    requestHeaders: (token, withBody) => ({ Authorization: `Token ${token}`, ...(withBody ? { 'Content-Type': 'application/json' } : {}) }),
    mapAsset: (raw: JsonObject): AssetInfo => ({ id: String(raw.id), name: String(raw.name), downloadUrl: String(raw.dl), downloadCount: 0 }),
    accountName: (raw) => String(raw.login),
    listReposQuery: '?per_page=100',
    listOrgsPath: '/user/orgs',
    orgName: (raw) => String(raw.login),
    newRepoBody: (name, description, isPrivate) => ({ name, description, private: isPrivate }),
    contentCreateMethod: 'PUT',
    listReleasesQuery: '?per_page=100',
    uploadAssetUrl: (repo, releaseId, encodedName) => `https://up.fake.test/${repo.owner}/${repo.repo}/${releaseId}/${encodedName}`,
    uploadAssetHeaders: (token) => ({ Authorization: `Token ${token}` }),
    downloadAssetHeaders: (token) => ({ Authorization: `Token ${token}` }),
    ...overrides,
  }
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, headers: { get: () => '' } } as unknown as Response
}

describe('makeRestHost - profile-driven shared engine', () => {
  const fetchMock = vi.fn()
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

  it('routes transport through the profile apiBase + auth header scheme', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ login: 'octocat' }]))
    await makeRestHost(fakeProfile()).listOrgs()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.fake.test/user/orgs')
    expect((init.headers as Record<string, string>).Authorization).toBe('Token TKN')
  })

  it('appends the profile listReposQuery and maps each repo', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ owner: { login: 'o' }, name: 'r', html_url: 'u' }]))
    const repos = await makeRestHost(fakeProfile({ listReposQuery: '?limit=50' })).listRepos()
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.fake.test/user/repos?limit=50')
    expect(repos[0]).toEqual({ owner: 'o', repo: 'r', url: 'u', isNew: false })
  })

  it('creates a new file with the profile contentCreateMethod, updates with PUT', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const host = makeRestHost(fakeProfile({ contentCreateMethod: 'POST' }))
    await host.putFile({ owner: 'o', repo: 'r' }, 'f.txt', 'body', 'msg')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    fetchMock.mockClear()
    await host.putFile({ owner: 'o', repo: 'r' }, 'f.txt', 'body', 'msg', 'SHA')
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
  })

  it('maps a created release through the profile mapAsset', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 9, tag_name: 'v1', html_url: 'r', assets: [{ id: 3, name: 'a.b3', dl: 'DOWN' }] }))
    const release = await makeRestHost(fakeProfile()).createRelease({ owner: 'o', repo: 'r' }, { tag: 'v1', title: 'v1' })
    expect(release.assets[0].downloadUrl).toBe('DOWN')
  })
})
