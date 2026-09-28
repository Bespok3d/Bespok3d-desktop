// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest'
import { indexKeySites, readPublishedKeyFile } from './key-files'

vi.mock('../git-host', () => ({ activeConnector: vi.fn() }))

afterEach(() => vi.restoreAllMocks())

describe('candidate keys in the dev index', () => {
  it('finds only published key files at the dev ref and reads their exact bytes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify([
      { path: 'keys/print-scheduler.pub.asc', type: 'file' },
      { path: 'keys/README.md', type: 'file' },
      { path: 'keys/other.pub.asc', type: 'dir' },
    ]), { status: 200 })).mockResolvedValueOnce(new Response('candidate public key', { status: 200 }))
    const sites = await indexKeySites('dev')
    expect(sites).toEqual([{ owner: 'Bespok3d', repo: 'main-index', path: 'keys/print-scheduler.pub.asc', ref: 'dev' }])
    expect(await readPublishedKeyFile(sites[0], sites[0].path)).toBe('candidate public key')
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.github.com/repos/Bespok3d/main-index/contents/keys?ref=dev',
      'https://raw.githubusercontent.com/Bespok3d/main-index/dev/keys/print-scheduler.pub.asc',
    ])
  })
})
