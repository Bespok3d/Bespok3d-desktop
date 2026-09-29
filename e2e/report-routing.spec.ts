// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { appEnv, bundledDaemonVersion, packagedBinary, rendererWindow } from './app-launch'
import { startStubDaemon } from './stub-daemon'
import type { StubDaemon } from './stub-daemon'
import { seedManagedPrinter } from './managed-printer-fixture'

const REGISTRY_URL = 'github:Bespok3d/main-index/index.json'
const PACKAGE_URL = 'https://github.com/Bespok3d/u1-extras/releases/download/v0.1.0/report-routing-refusal.b3'
const MALFORMED_SIGNATURE = '-----BEGIN PGP SIGNATURE-----\n\nnot actually a signature\n-----END PGP SIGNATURE-----\n'

const REFUSED_PLUGIN = {
  name: 'report-routing-refusal',
  version: '0.1.0',
  title: 'Report Routing Refusal Fixture',
  registry_url: REGISTRY_URL,
  description: 'E2E fixture: a package whose signature fails verification',
  category: 'other',
  channel: 'stable',
  publisher: 'Bespok3d',
  printer_specific: false,
  published_at: '2026-01-01',
  updated_at: '2026-01-01',
  requires: { capabilities: [] },
  provides: [],
  deps: [],
  conflicts: [],
  download_url: PACKAGE_URL,
}

function buildRefusedArchive(): Buffer {
  const archive = new AdmZip()
  archive.addFile('manifest.json', Buffer.from(`${JSON.stringify({
    name: REFUSED_PLUGIN.name,
    version: REFUSED_PLUGIN.version,
    title: REFUSED_PLUGIN.title,
    description: REFUSED_PLUGIN.description,
    category: REFUSED_PLUGIN.category,
    install: {},
  }, null, 2)}\n`, 'utf8'))
  archive.addFile('manifest.json.sig', Buffer.from(MALFORMED_SIGNATURE, 'utf8'))

  return archive.toBuffer()
}

function registryFixture(): string {
  return JSON.stringify({
    schema_version: 1,
    name: 'Bespok3d Official',
    publisher: 'Bespok3d',
    updated: '2026-01-01',
    plugins: [REFUSED_PLUGIN],
    lists: [],
  })
}

async function installMainProcessTestSeams(
  app: ElectronApplication,
  indexBody: string,
  archiveBase64: string,
): Promise<void> {
  await app.evaluate(({ ipcMain }, fixture) => {
    const testState = { openedUrls: [] as string[] }
    const packageBytes = Buffer.from(fixture.archiveBase64, 'base64')

    function requestUrlOf(request: RequestInfo | URL): string {
      if (typeof request === 'string') return request
      if (request instanceof URL) return request.toString()

      return request.url
    }

    globalThis.fetch = async (request) => {
      const requestUrl = requestUrlOf(request)
      if (requestUrl.endsWith('/releases/latest/download/index.json')) {
        return new Response(fixture.indexBody, { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (requestUrl === fixture.packageUrl) return new Response(packageBytes, { status: 200 })
      if (requestUrl.endsWith('/index.json.sig')) return new Response('', { status: 404 })

      return new Response('', { status: 404 })
    }

    ;(globalThis as typeof globalThis & { reportRoutingTestState?: typeof testState }).reportRoutingTestState = testState
    ipcMain.removeHandler('shell:openUrl')
    ipcMain.handle('shell:openUrl', (_event, url: string) => { testState.openedUrls.push(url) })
  }, { indexBody, archiveBase64, packageUrl: PACKAGE_URL })
}

async function capturedReportUrls(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => {
    const state = (globalThis as typeof globalThis & { reportRoutingTestState?: { openedUrls: string[] } }).reportRoutingTestState

    return state?.openedUrls ?? []
  })
}

test.describe('report routing for an index-installed refused package', () => {
  var app: ElectronApplication
  var page: Page
  var daemon: StubDaemon

  test.beforeAll(async () => {
    test.setTimeout(60_000)
    const userData = mkdtempSync(join(tmpdir(), 'b3-report-routing-'))
    daemon = await startStubDaemon(bundledDaemonVersion())
    seedManagedPrinter(userData, daemon)
    app = await electron.launch({
      executablePath: packagedBinary(),
      args: [`--user-data-dir=${userData}`],
      env: appEnv(),
    })
    await installMainProcessTestSeams(app, registryFixture(), buildRefusedArchive().toString('base64'))
    page = await rendererWindow(app)
    await page.reload()
    await page.waitForTimeout(400)
    await page.locator('.card-title').first().waitFor({ timeout: 30_000 })
  })

  test.afterAll(async () => {
    try {
      await app?.close()
    } finally {
      await daemon?.stop()
    }
  })

  test('opens the index plugin repository from the real refusal report action', async () => {
    await page.getByPlaceholder('Search plugins…').fill('Report Routing Refusal')
    await page.waitForTimeout(300)
    await page.locator('.card-title', { hasText: 'Report Routing Refusal Fixture' }).first().click()
    await page.locator('.plugin-modal').waitFor({ timeout: 10_000 })
    await page.locator('.panel-foot button', { hasText: 'Install' }).click()
    const proceedWithListing = page.getByRole('button', { name: 'Proceed with the proposed list' })
    await proceedWithListing.waitFor({ timeout: 10_000 })
    await proceedWithListing.click()

    const modal = page.locator('.report-modal')
    await modal.waitFor({ timeout: 15_000 })
    await expect(modal.locator('.modal-head h2')).toContainText('was not installed')
    await expect(modal.locator('.modal-head p')).toHaveText(
      'This package failed a security check. Your printer was not changed.',
    )
    await modal.getByRole('button', { name: 'Report the problem' }).click()

    await expect.poll(() => capturedReportUrls(app)).toHaveLength(1)
    const [reportUrl] = await capturedReportUrls(app)
    const reportAddress = new URL(reportUrl)
    expect(`${reportAddress.origin}${reportAddress.pathname}`).toBe('https://github.com/Bespok3d/u1-extras/issues/new')
    expect(reportUrl).not.toContain('Bespok3d/main-index')
    expect(app.windows()).toHaveLength(1)
  })
})
