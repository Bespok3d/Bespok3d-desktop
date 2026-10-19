// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { packagedBinary, appEnv, rendererWindow, bundledDaemonVersion } from './app-launch'
import { buildLocalIndex } from '../src/main/registry/local/build-index'
import type { StoredManifest } from '../src/main/registry/local/b3-manifest'
import { startStubDaemon } from './stub-daemon'
import { seedManagedPrinter } from './managed-printer-fixture'

const manifests: StoredManifest[] = [
  { name: 'required-one', version: '1.0.0', title: 'Required One', install: {}, config: [
    { key: 'SERVER', label: 'First server', type: 'text', scope: 'global', required: true },
    { key: 'OPTIONAL', label: 'Optional note', type: 'text', scope: 'global' },
  ] },
  { name: 'required-two', version: '1.0.0', title: 'Required Two', install: {}, config: [
    { key: 'SERVER', label: 'Second server', type: 'text', scope: 'global', required: true },
  ] },
]

function seedCatalog(userData: string): void {
  const catalogDir = join(userData, 'local-plugins')
  mkdirSync(catalogDir, { recursive: true })
  writeFileSync(join(catalogDir, 'index.json'), `${JSON.stringify(buildLocalIndex(manifests))}\n`, 'utf8')
}

test('one batch screen separates required values and closes on cancellation', async () => {
  var app: ElectronApplication | undefined
  const userData = mkdtempSync(join(tmpdir(), 'b3-required-batch-'))
  const daemon = await startStubDaemon(bundledDaemonVersion())
  seedManagedPrinter(userData, daemon)
  seedCatalog(userData)
  try {
    app = await electron.launch({ executablePath: packagedBinary(), args: [`--user-data-dir=${userData}`], env: appEnv() })
    const page: Page = await rendererWindow(app)
    await page.locator('.card-title', { hasText: 'Required One' }).waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Select plugins' }).click()
    await page.getByText('Select to install').click()
    await page.locator('.card-title', { hasText: 'Required One' }).click()
    await page.locator('.card-title', { hasText: 'Required Two' }).click()
    await page.getByRole('button', { name: 'Install selected (2)' }).click()

    const modal = page.locator('.batch-config-modal')
    await expect(modal).toBeVisible()
    await expect(modal.locator('.batch-config-group')).toHaveCount(2)
    await expect(modal.getByText('Optional note')).toHaveCount(0)
    const install = modal.getByRole('button', { name: 'Install 2' })
    await expect(install).toBeDisabled()
    await modal.locator('.batch-config-group').nth(0).getByRole('textbox').fill('first.local')
    await expect(install).toBeDisabled()
    await modal.locator('.batch-config-group').nth(1).getByRole('textbox').fill('second.local')
    await expect(install).toBeEnabled()
    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(modal).toHaveCount(0)
  } finally {
    await app?.close()
    await daemon.stop()
  }
})
