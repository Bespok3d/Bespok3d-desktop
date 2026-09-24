// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { appEnv, packagedBinary, rendererWindow } from './app-launch'

test('background windows render and accept input without showing or taking focus', async () => {
  test.skip(process.env.B3D_E2E_HEADED === '1', 'Background-only window contract')
  const userData = mkdtempSync(join(tmpdir(), 'b3-background-'))
  const app = await electron.launch({ executablePath: packagedBinary(), args: [`--user-data-dir=${userData}`], env: appEnv() })
  try {
    const page = await rendererWindow(app)
    await page.getByRole('button', { name: /Add a printer/i }).first().click()
    await expect(page.getByText('Find a printer on your network or enter its address manually.')).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('background-renderer.png') })
    const states = await app.evaluate(({ BrowserWindow, app: desktop }) => {
      // Constructed the way the background hook builds every app window (show: false), so the
      // forced activation calls below are the thing under test: a window this app made must stay
      // hidden and unfocused no matter how hard it is asked to appear.
      const popup = new BrowserWindow({ width: 200, height: 100, show: false })
      popup.show()
      popup.showInactive()
      popup.focus()
      popup.restore()
      desktop.focus({ steal: true })
      const windows = BrowserWindow.getAllWindows().map((window) => ({ visible: window.isVisible(), focused: window.isFocused() }))
      popup.destroy()

      return windows
    })
    expect(states.length).toBeGreaterThanOrEqual(2)
    expect(states.every((window) => !window.visible && !window.focused)).toBe(true)
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
