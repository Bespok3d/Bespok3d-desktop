import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { appEnv, packagedBinary, rendererWindow } from './app-launch'

// The E2E launches the PACKAGED app (electron-builder --dir): only then does app.isPackaged route the
// adapter paths to resources/adapters. The raw unpackaged out/ build resolves them relative to a dev
// layout and crashes. scripts/e2e.sh produces the package before running this.

test('boots end to end and opens the Add printer flow', async () => {
  // A cold packaged-app boot with an empty profile waits on the catalog fetch (the official remote times
  // out after ~8s offline) plus electron cold-start; it runs ~37s solo and tips past the 60s default when
  // the suite has warmed the machine. Give the boot real headroom so it is not order-dependent.
  test.setTimeout(120_000)
  const userData = mkdtempSync(join(tmpdir(), 'b3-e2e-'))
  const app = await electron.launch({
    executablePath: packagedBinary(),
    args: [`--user-data-dir=${userData}`],
    env: appEnv(),
  })
  try {
    const window = await rendererWindow(app)
    await expect(window.getByText('No printers yet')).toBeVisible({ timeout: 20_000 })

    await window.getByRole('button', { name: /Add a printer/i }).first().click()
    await expect(
      window.getByText('Find a printer on your network or enter its address manually.'),
    ).toBeVisible()
  } finally {
    await app.close()
  }
})
