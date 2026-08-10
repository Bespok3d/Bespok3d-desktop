// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { _electron as electron } from '@playwright/test'
import { packagedBinary, appEnv, rendererWindow, shoot, SHOTS_DIR, bundledDaemonVersion } from './app-launch'

// Plain-artifact screenshots of the real packaged app (no pixel-baseline comparison, so no
// cross-platform flake). Output goes to repo-root/screenshots for review and for the wiki. Run via
// scripts/screenshots.sh (builds + packages arm64, then runs only this spec). NOT in check.sh.

const SETTINGS_PANES = [
  'General', 'Plugin defaults', 'Language', 'Printers', 'Keys', 'Access',
  'Git Host', 'Repositories', 'Adapters', 'Labs', 'Update', 'About',
]

async function capturePane(window: Page, label: string, index: number): Promise<void> {
  const navButton = window.getByRole('button', { name: label, exact: true })
  if (!(await navButton.count())) return
  await navButton.first().click()
  const slug = label.toLowerCase().replace(/ /g, '-')
  await shoot(window, `${String(index).padStart(2, '0')}-settings-${slug}.png`)
}

// A managed printer record so the catalog (which only renders for a selected managed printer) appears.
// The store browses the bundled index with no daemon, so this is enough to reach the whole store UI.
function seedManagedPrinter(userData: string): void {
  const printersDir = join(userData, 'printers')
  mkdirSync(printersDir, { recursive: true })
  const record = {
    id: 'demo-u1', nick: 'Workshop U1', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
    host: 'workshop-u1.local', ip: '192.168.1.50', status: 'managed', installedIds: [],
    daemonVersion: bundledDaemonVersion(),
  }
  writeFileSync(join(printersDir, 'demo-u1.json'), JSON.stringify(record, null, 2), 'utf-8')
}

async function captureDetailTabs(window: Page): Promise<void> {
  const tabs = [['Doc', '32-store-detail-doc'], ['Config', '33-store-detail-config'], ['Changelog', '34-store-detail-changelog']]
  await tabs.reduce((chain, [label, name]) => chain.then(async () => {
    const tab = window.getByRole('button', { name: label, exact: true })
    if (!(await tab.count())) return
    await tab.first().click()
    await shoot(window, `${name}.png`)
  }), Promise.resolve())
}

async function captureStore(window: Page): Promise<void> {
  await window.locator('.card-title').first().waitFor({ timeout: 20_000 })
  await shoot(window, '30-store-grid.png')
  await window.getByPlaceholder('Search plugins…').fill('spool')
  await window.waitForTimeout(300)
  await window.locator('.card-title', { hasText: 'Spoolman' }).first().click()
  await shoot(window, '31-store-detail-overview.png')
  await captureDetailTabs(window)
  await window.getByRole('button', { name: 'Close', exact: true }).first().click()
  await window.waitForTimeout(300)
  await window.locator('.printer-trigger').first().click()
  await shoot(window, '40-printer-dropdown.png')
}

test('captures the app gallery', async () => {
  mkdirSync(SHOTS_DIR, { recursive: true })
  const userData = mkdtempSync(join(tmpdir(), 'b3-shots-'))
  const app = await electron.launch({
    executablePath: packagedBinary(),
    args: [`--user-data-dir=${userData}`],
    env: appEnv(),
  })
  try {
    const window = await rendererWindow(app)
    await window.getByText('No printers yet').waitFor({ timeout: 20_000 })
    await shoot(window, '01-first-run.png')

    await window.getByRole('button', { name: 'Settings', exact: true }).first().click()
    await SETTINGS_PANES.reduce(
      (chain, label, position) => chain.then(() => capturePane(window, label, position + 10)),
      Promise.resolve(),
    )
    await window.getByRole('button', { name: 'Close', exact: true }).first().click()
    await window.waitForTimeout(300)

    await window.getByRole('button', { name: /Add a printer/i }).first().click()
    await shoot(window, '02-add-printer.png')
  } finally {
    await app.close()
  }
})

test('captures the store gallery', async () => {
  mkdirSync(SHOTS_DIR, { recursive: true })
  const userData = mkdtempSync(join(tmpdir(), 'b3-shots-store-'))
  seedManagedPrinter(userData)
  const app = await electron.launch({
    executablePath: packagedBinary(),
    args: [`--user-data-dir=${userData}`],
    env: appEnv(),
  })
  try {
    const window = await rendererWindow(app)
    await captureStore(window)
  } finally {
    await app.close()
  }
})
