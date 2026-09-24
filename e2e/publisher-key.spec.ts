// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { appEnv, packagedBinary, rendererWindow } from './app-launch'

const OWNER = 'fixture-publisher'
const REPO = 'bespok3d-publisher'

function seedDisposableConnection(userData: string): void {
  const keychainDir = join(userData, 'keychain')
  mkdirSync(keychainDir, { recursive: true })
  writeFileSync(join(keychainDir, 'github-token.plain'), 'disposable-fixture-token')
}

test('the development key control publishes the generated public key through the real app bridge', async () => {
  test.setTimeout(120_000)
  const userData = mkdtempSync(join(tmpdir(), 'b3-publisher-key-'))
  seedDisposableConnection(userData)
  const app = await electron.launch({
    executablePath: packagedBinary(),
    args: [`--user-data-dir=${userData}`],
    env: { ...appEnv(), B3D_DEV_FEATURES: '1' },
  })

  try {
    await app.evaluate(() => {
      const files = new Map<string, string>()
      const previousFetch = globalThis.fetch
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input))
        if (url.origin !== 'https://api.github.com') return previousFetch(input, init)
        const method = init?.method ?? 'GET'
        function reply(body: unknown, status = 200): Response {
          return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
        }
        if (url.pathname === '/user' && method === 'GET') return reply({ login: 'fixture-publisher', name: 'Fixture Publisher' })
        if (url.pathname === '/user/repos' && method === 'GET') return reply([])
        if (url.pathname === '/user/repos' && method === 'POST') {
          if (JSON.parse(String(init?.body)).private !== false) return reply({ message: 'Publisher repository must be public' }, 400)

          return reply({ owner: { login: 'fixture-publisher' }, name: 'bespok3d-publisher', html_url: 'https://github.example/fixture-publisher/bespok3d-publisher' })
        }
        if (url.pathname === '/repos/fixture-publisher/bespok3d-publisher' && method === 'GET') return reply({}, 404)
        const contentPrefix = '/repos/fixture-publisher/bespok3d-publisher/contents/'
        if (!url.pathname.startsWith(contentPrefix)) return reply({}, 404)
        const path = url.pathname.slice(contentPrefix.length)
        if (method === 'GET') {
          const content = files.get(path)

          return content === undefined ? reply({}, 404) : reply({ content: Buffer.from(content).toString('base64'), sha: 'fixture-sha' })
        }
        if (method !== 'PUT') return reply({}, 405)
        const body = JSON.parse(String(init?.body)) as { content: string }
        files.set(path, Buffer.from(body.content, 'base64').toString('utf8'))

        return reply({})
      }
    })

    const window = await rendererWindow(app)
    await window.getByRole('button', { name: 'Settings', exact: true }).first().click()
    await window.getByRole('button', { name: 'Keys', exact: true }).click()
    await window.getByPlaceholder('Label, e.g. My laptop').fill('Disposable publisher')
    await window.getByRole('button', { name: 'Generate', exact: true }).click()

    const publish = window.getByRole('button', { name: `Publish to ${OWNER}/${REPO}` })
    await expect(publish).toBeEnabled()
    await publish.click()
    await expect(window.getByRole('button', { name: `Published · ${OWNER}/${REPO}` })).toBeVisible()

    const published = await window.evaluate(async () => {
      const [key] = await globalThis.window.b3d.keys.list()
      const path = `keys/${key.fingerprint.toLowerCase()}/key.asc`
      const publicFile = await globalThis.window.b3d.gitHost.getFile('fixture-publisher', 'bespok3d-publisher', path)
      const readme = await globalThis.window.b3d.gitHost.getFile('fixture-publisher', 'bespok3d-publisher', 'README.md')
      const privateKey = await globalThis.window.b3d.keys.exportPrivate(key.id)

      return { key, publicFile, readme, privateKey }
    })
    expect(published.publicFile?.content).toBe(published.key.publicKey)
    expect(published.readme?.content).toContain(published.key.fingerprint)
    expect(published.readme?.content).toContain(`(keys/${published.key.fingerprint.toLowerCase()}/key.asc)`)
    expect(published.publicFile?.content).not.toBe(published.privateKey)
    expect(published.readme?.content).not.toContain(published.privateKey)
    expect(published.key.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
