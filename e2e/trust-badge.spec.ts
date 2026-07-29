// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { packagedBinary, appEnv, rendererWindow } from './app-launch'
import { EXPECTED_DAEMON_VERSION } from '../src/main/daemon-client/version'
import { buildLocalIndex } from '../src/main/registry/local/build-index'
import type { StoredManifest } from '../src/main/registry/local/b3-manifest'

// Proves a sideloaded catalog entry earns and renders the correct trust tier under a real render: real
// packaged app, real derivedTrust() resolver, real TrustPill component. No .b3 archive is needed - the
// catalog detail modal only reads index.json; resolveArchiveBytes() is never touched until an install is
// attempted. Off the default check.sh gate; runs via ./scripts/check.sh e2e.

const BADGE_PLUGIN: StoredManifest = {
  name: 'badge-fixture',
  version: '1.0.0',
  title: 'Badge Fixture Plugin',
  description: 'E2E fixture: a sideloaded entry that must render the "any" trust tier',
  category: 'other',
  install: {},
}

function seedManagedPrinter(userData: string): void {
  const printersDir = join(userData, 'printers')
  mkdirSync(printersDir, { recursive: true })
  const record = {
    id: 'demo-u1', nick: 'Workshop U1', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
    host: 'workshop-u1.local', ip: '192.168.1.50', status: 'managed', installedIds: [],
    daemonVersion: EXPECTED_DAEMON_VERSION,
  }
  writeFileSync(join(printersDir, 'demo-u1.json'), JSON.stringify(record, null, 2), 'utf-8')
}

function seedSideloadedCatalogEntry(userData: string): void {
  const localDir = join(userData, 'local-plugins')
  mkdirSync(localDir, { recursive: true })
  const index = buildLocalIndex([BADGE_PLUGIN])
  writeFileSync(join(localDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf-8')
}

test.describe('trust badge: a sideloaded entry renders its real, derived trust tier', () => {
  var app: ElectronApplication
  var page: Page

  test.beforeAll(async () => {
    test.setTimeout(60_000)
    const userData = mkdtempSync(join(tmpdir(), 'b3-badge-'))
    seedManagedPrinter(userData)
    seedSideloadedCatalogEntry(userData)
    app = await electron.launch({ executablePath: packagedBinary(), args: [`--user-data-dir=${userData}`], env: appEnv() })
    page = await rendererWindow(app)
    await page.waitForTimeout(400)
    await page.locator('.card-title').first().waitFor({ timeout: 30_000 })
  })

  test.afterAll(async () => {
    await app?.close()
  })

  test('a sideloaded plugin shows the "Unknown publisher" trust badge, not a manufacturer badge', async () => {
    await page.getByPlaceholder('Search plugins…').fill('Badge Fixture')
    await page.waitForTimeout(300)
    await page.locator('.card-title', { hasText: 'Badge Fixture Plugin' }).first().click()
    await page.locator('.plugin-modal').waitFor({ timeout: 10_000 })

    const badge = page.locator('.plugin-modal .panel-head .panel-stat-row .trust.any')
    await expect(badge).toHaveText('Unknown publisher')
    await expect(badge).toHaveAttribute('title', 'Unknown publisher')
  })
})
