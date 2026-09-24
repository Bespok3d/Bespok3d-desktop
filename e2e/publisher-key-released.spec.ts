// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, _electron as electron } from '@playwright/test'
import * as openpgp from 'openpgp'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { appEnv, packagedBinary, rendererWindow, bundledDaemonVersion } from './app-launch'

// The released-build path of key trust, against a simulated public host: a packaged app with no
// development features must publish and report its key exactly as a publisher's install does, and
// must render the trust result of a third-party signed list whose key it discovers on that host.
// The development-build publication E2E (publisher-key.spec.ts) stays as its regression.

const OWNER = 'fixture-publisher'
const REPO = 'bespok3d-publisher'
const LIST_NAME = 'fixture-list'

function seedDisposableConnection(userData: string): void {
  const keychainDir = join(userData, 'keychain')
  mkdirSync(keychainDir, { recursive: true })
  writeFileSync(join(keychainDir, 'github-token.plain'), 'disposable-fixture-token')
}

function seedManagedPrinter(userData: string): void {
  const printersDir = join(userData, 'printers')
  mkdirSync(printersDir, { recursive: true })
  writeFileSync(join(printersDir, 'demo-u1.json'), JSON.stringify({
    id: 'demo-u1', nick: 'Workshop U1', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
    host: 'workshop-u1.local', ip: '192.168.1.50', status: 'managed', installedIds: [],
    daemonVersion: bundledDaemonVersion(),
  }, null, 2), 'utf-8')
}

// The official remote source starts off so the startup catalog load never reaches a real host; the
// simulated host below serves it from the moment the test turns the source on.
function seedOfficialSourceDisabled(userData: string): void {
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({
    disabledSources: ['github:Bespok3d/main-index/index.json'],
  }, null, 2), 'utf-8')
}

function listBytes(index: Record<string, unknown>): string {
  return `${JSON.stringify(index, null, 2)}\n`
}

async function detachedOver(bytesToSign: string, signingKey: openpgp.PrivateKey): Promise<string> {
  const message = await openpgp.createMessage({ binary: new TextEncoder().encode(bytesToSign) })

  return await openpgp.sign({ message, signingKeys: signingKey, detached: true }) as string
}

interface SignedListFixture {
  served: Record<string, string>
  signerName: string
}

async function signedThirdPartyListFixture(): Promise<SignedListFixture> {
  const generated = await openpgp.generateKey({ userIDs: [{ name: 'E2E Publisher', email: 'publisher@example.invalid' }], format: 'object' })
  const fingerprint = generated.publicKey.getFingerprint().toLowerCase()
  const pluginName = 'fixture-third-party'
  const subList = listBytes({
    schema_version: 1,
    name: 'Fixture Third Party',
    publisher: fingerprint,
    updated: '2026-09-24',
    plugins: [{
      name: pluginName,
      title: 'Fixture Third Party Plugin',
      version: '1.0.0',
      description: 'E2E fixture: an atom signed by a disposable third-party publisher.',
      category: 'system',
      channel: 'stable',
      publisher: fingerprint,
      printer_specific: false,
      download_url: `https://api.github.com/repos/${OWNER}/${pluginName}/releases/assets/4242`,
      deps: [],
      conflicts: [],
      provides: [],
    }],
    collections: [],
    lists: [],
  })
  const officialIndex = listBytes({
    schema_version: 1,
    name: 'Bespok3d Official',
    publisher: fingerprint,
    updated: '2026-09-24',
    plugins: [],
    collections: [],
    lists: [{ name: 'Fixture Third Party', url: `github:${OWNER}/${LIST_NAME}/index.json`, trust: 'community' }],
  })

  return {
    served: {
      'https://github.com/Bespok3d/main-index/releases/latest/download/index.json': '',
      'https://raw.githubusercontent.com/Bespok3d/main-index/main/index.json': officialIndex,
      [`https://github.com/${OWNER}/${LIST_NAME}/releases/latest/download/index.json`]: '',
      [`https://raw.githubusercontent.com/${OWNER}/${LIST_NAME}/main/index.json`]: subList,
      [`https://raw.githubusercontent.com/${OWNER}/${LIST_NAME}/main/index.json.sig`]: await detachedOver(subList, generated.privateKey),
      [`https://raw.githubusercontent.com/${OWNER}/${REPO}/HEAD/keys/${fingerprint}/key.asc`]: generated.publicKey.armor(),
    },
    signerName: OWNER,
  }
}

test('the released key surface publishes a key and the UI states what it verified', async () => {
  test.setTimeout(120_000)
  const userData = mkdtempSync(join(tmpdir(), 'b3-released-key-'))
  seedDisposableConnection(userData)
  const app = await electron.launch({
    executablePath: packagedBinary(),
    args: [`--user-data-dir=${userData}`],
    env: appEnv(),
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
    await window.getByRole('dialog').waitFor()
    await window.getByRole('button', { name: 'Keys', exact: true }).click()
    await window.getByPlaceholder('Label, e.g. My laptop').fill('Disposable publisher')
    await window.getByRole('button', { name: 'Generate', exact: true }).click()

    const publish = window.getByRole('button', { name: `Publish to ${OWNER}/${REPO}` })
    await expect(publish).toBeEnabled({ timeout: 20_000 })
    await publish.click()
    const published = window.getByRole('button', { name: `Published · ${OWNER}/${REPO}` })
    await expect(published).toBeVisible()
    await published.click()
    await expect(window.locator('.flyout-note')).toHaveText(`Verified: this key's public half is the file at ${OWNER}/${REPO}`)

    const checked = await window.evaluate(async () => {
      const [key] = await globalThis.window.b3d.keys.list()
      const path = `keys/${key.fingerprint.toLowerCase()}/key.asc`
      const publicFile = await globalThis.window.b3d.gitHost.getFile('fixture-publisher', 'bespok3d-publisher', path)
      const privateKey = await globalThis.window.b3d.keys.exportPrivate(key.id)

      return { publishedContent: publicFile?.content ?? null, publicKey: key.publicKey, privateKey }
    })
    expect(checked.publishedContent).toBe(checked.publicKey)
    expect(checked.publishedContent).not.toBe(checked.privateKey)
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
})

test('a third-party signed list shows the community trust result and its proved signer', async () => {
  test.setTimeout(120_000)
  const userData = mkdtempSync(join(tmpdir(), 'b3-released-trust-'))
  seedManagedPrinter(userData)
  seedOfficialSourceDisabled(userData)
  const fixture = await signedThirdPartyListFixture()
  const app = await electron.launch({
    executablePath: packagedBinary(),
    args: [`--user-data-dir=${userData}`],
    env: appEnv(),
  })

  try {
    await app.evaluate((_electron, servedFiles: Record<string, string>) => {
      globalThis.fetch = async (input) => {
        const url = String(input)

        return new Response(servedFiles[url] ?? '{}', { status: servedFiles[url] === undefined ? 404 : 200 })
      }
    }, fixture.served)

    const window = await rendererWindow(app)
    await window.getByRole('button', { name: 'Settings', exact: true }).first().click()
    await window.getByRole('dialog').waitFor()
    await window.getByRole('button', { name: 'Repositories', exact: true }).click()
    const sourceRow = window.locator('.repo-row', { hasText: 'github:Bespok3d/main-index' })
    await sourceRow.locator('.toggle').click()
    await expect(sourceRow).not.toHaveClass(/disabled/)
    await window.getByRole('button', { name: 'Close', exact: true }).click()

    await window.getByPlaceholder('Search plugins…').fill('Fixture Third Party')
    const fixtureCard = window.locator('.card-title', { hasText: 'Fixture Third Party Plugin' }).first()
    await fixtureCard.waitFor({ timeout: 30_000 })
    await fixtureCard.click()
    await window.locator('.plugin-modal').waitFor({ timeout: 10_000 })

    const trustBadge = window.locator('.plugin-modal .panel-head .panel-stat-row .trust.community')
    await expect(trustBadge).toHaveText('Community verified')
    await expect(window.locator('.plugin-modal .panel-head .chip', { hasText: fixture.signerName })).toBeVisible()
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
