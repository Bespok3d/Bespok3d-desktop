// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as openpgp from 'openpgp'
import { generateKey, exportPrivateKey, listKeys, removeKey, setPublishedAt } from '../../src/main/keys'
import { createGitHubConnector } from '../../src/main/git-host/github'
import { PUBLISHER_REPO, keyFilePath } from '../../src/main/publisher/repo'

vi.mock('../../src/main/git-host/keychain', () => ({ load: () => 'fixture-token', save: vi.fn(), clear: vi.fn() }))

const OWNER = 'fixture-publisher'
const REPO = PUBLISHER_REPO

function githubResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('publisher key store and GitHub connector', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('exports an unlocked signing key whose fingerprint matches the published path', async () => {
    const key = await generateKey({ label: 'Disposable signing key' })
    try {
      const privateKey = await openpgp.readPrivateKey({ armoredKey: exportPrivateKey(key.id) })
      expect(privateKey.isDecrypted()).toBe(true)
      expect(keyFilePath(key.fingerprint)).toBe(`keys/${privateKey.getFingerprint()}/key.asc`)
      const message = await openpgp.createMessage({ text: 'fixture manifest' })
      const signature = await openpgp.sign({ message, signingKeys: privateKey, detached: true, format: 'armored' })
      expect(signature).toContain('BEGIN PGP SIGNATURE')
    } finally {
      removeKey(key.id)
    }
  })

  it('writes only the public key and README to a public repository', async () => {
    const key = await generateKey({ label: 'Disposable publisher' })
    const privateKey = exportPrivateKey(key.id)
    const files = new Map<string, string>()
    const writes: string[] = []
    const fetchFixture = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      if (url.pathname === '/user/repos' && method === 'GET') return githubResponse([])
      if (url.pathname === `/repos/${OWNER}/${REPO}` && method === 'GET') return githubResponse({}, 404)
      if (url.pathname === '/user' && method === 'GET') return githubResponse({ login: OWNER, name: 'Fixture Publisher' })
      if (url.pathname === '/user/repos' && method === 'POST') {
        expect(JSON.parse(String(init?.body))).toMatchObject({ name: REPO, private: false })

        return githubResponse({ owner: { login: OWNER }, name: REPO, html_url: `https://github.example/${OWNER}/${REPO}` })
      }
      const contentPrefix = `/repos/${OWNER}/${REPO}/contents/`
      if (!url.pathname.startsWith(contentPrefix)) throw new Error(`Unexpected GitHub request: ${method} ${url.pathname}`)
      const path = url.pathname.slice(contentPrefix.length)
      if (method === 'GET') {
        const content = files.get(path)

        return content === undefined ? githubResponse({}, 404) : githubResponse({ content: Buffer.from(content).toString('base64'), sha: 'fixture-sha' })
      }
      if (method !== 'PUT') throw new Error(`Unexpected GitHub write: ${method} ${path}`)
      const body = JSON.parse(String(init?.body)) as { content: string }
      files.set(path, Buffer.from(body.content, 'base64').toString('utf8'))
      writes.push(path)

      return githubResponse({})
    })
    vi.stubGlobal('fetch', fetchFixture)
    const connector = createGitHubConnector('fixture-client')
    try {
      expect(await connector.listRepos()).toEqual([])
      await connector.createRepo(REPO, 'Fixture publisher keys')
      const publicPath = keyFilePath(key.fingerprint)
      expect(publicPath).toBe(`keys/${key.fingerprint.toLowerCase()}/key.asc`)
      expect(await connector.getFile({ owner: OWNER, repo: REPO }, publicPath)).toBeNull()
      await connector.putFile({ owner: OWNER, repo: REPO }, publicPath, key.publicKey, 'Publish disposable key')
      await connector.putFile({ owner: OWNER, repo: REPO }, 'README.md', `# Fixture publisher keys\n${key.fingerprint}\n`, 'List disposable key')
      const date = new Date().toISOString().slice(0, 10)
      setPublishedAt(key.id, date)
      expect(writes).toEqual([publicPath, 'README.md'])
      expect(files.get(publicPath)).toBe(key.publicKey)
      expect((await connector.getFile({ owner: OWNER, repo: REPO }, publicPath))?.content).toBe(key.publicKey)
      expect(files.get(publicPath)).not.toBe(privateKey)
      expect(files.get('README.md')).toContain(key.fingerprint)
      expect(listKeys().find((stored) => stored.id === key.id)?.publishedAt).toBe(date)
    } finally {
      removeKey(key.id)
    }
  })
})
