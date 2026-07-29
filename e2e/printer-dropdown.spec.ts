// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { packagedBinary, appEnv, rendererWindow } from './app-launch'
import { startStubDaemon } from './stub-daemon'
import type { StubDaemon } from './stub-daemon'
import { EXPECTED_DAEMON_VERSION } from '../src/main/daemon-client/version'

// Real-layout + real-stacking canaries for the header printer-selection dropdown, driven against the REAL
// packaged app via Playwright-electron. The jsdom cage (PrinterDropdown.test.tsx) already covers the
// FUNCTIONAL behavior (selection, settings, endpoint click, the full status x reach dot matrix); jsdom has
// no layout engine and no paint order, so what it CANNOT verify - and what this adds - is GEOMETRY (the
// status dot anchored on the avatar) and STACKING (the open menu painting on top of page content, and the
// z-order relationship between the menu and an open modal scrim).
//
// THE Z-ORDER REQUIREMENT: the printer dropdown is global navigation and must stay reachable ON TOP of any
// modal shade. app.css used to stack header z:70 (a stacking context, so the printer-menu z:62 is trapped
// inside it) BELOW the modal-scrim z:100 / settings-scrim z:90, so an open modal covered the dropdown and
// (because the trigger sat under the scrim) you could not even open it over a modal. The fix lifts .header
// above the scrims (z:120), which lifts the trapped menu with it. This spec pins BOTH the menu-on-content
// invariant (no modal) AND the dropdown-stays-on-top-of-the-modal invariant, while the scrim still
// dismisses from the content area below the header. Off the default gate; runs via scripts/e2e.sh.

const WINDOW = { width: 1100, height: 720 }
// Behind the bundled daemon, so the app derives a pending update for Beta from the stub's own answer.
const BETA_DAEMON_VERSION = '0.10.0-dev'

// Beta is the printer with a daemon answering (the stub, on 127.0.0.1), so it is the one the app can
// grade managed and therefore the only one that can carry a managed-only affordance. Alpha keeps a
// fake LAN address with nothing behind it and grades offline, which is the contrast the menu should
// show. Neither status is seeded: the app re-grades every record from `checking` at boot, so what a
// record says here is only a starting point.
function seedPrinters(userData: string, daemon: StubDaemon): void {
  const printersDir = join(userData, 'printers')
  mkdirSync(printersDir, { recursive: true })
  const base = { model: 'Snapmaker U1', adapter: 'snapmaker-u1', status: 'managed', installedIds: [] }
  const records = [
    {
      id: 'alpha-u1', nick: 'Alpha', host: 'alpha.local', ip: '192.168.7.51',
      daemonVersion: EXPECTED_DAEMON_VERSION,
      endpoints: [{ label: 'Fluidd', url: 'http://192.168.7.51/' }], ...base,
    },
    {
      id: 'beta-u1', nick: 'Beta', host: 'beta.local', ip: '127.0.0.1',
      daemonVersion: BETA_DAEMON_VERSION,
      daemonCert: daemon.cert, daemonToken: daemon.token, ...base,
    },
  ]
  records.forEach((record) => writeFileSync(join(printersDir, `${record.id}.json`), JSON.stringify(record, null, 2), 'utf-8'))
}

interface Box { x: number; y: number; width: number; height: number }

async function openMenu(page: Page): Promise<void> {
  const menu = page.locator('.printer-menu')
  if (await menu.isVisible().catch(() => false)) return
  await page.locator('.printer-trigger').click()
  await menu.waitFor({ state: 'visible' })
}

// elementFromPoint at (x, y): which named surface owns that pixel (what the user would actually click).
function surfaceAt(page: Page, x: number, y: number): Promise<{ inMenu: boolean; inScrim: boolean; inTrigger: boolean }> {
  return page.evaluate(({ px, py }) => {
    const element = document.elementFromPoint(px, py)

    return {
      inMenu: !!element?.closest('.printer-menu'),
      inScrim: !!element?.closest('.modal-scrim'),
      inTrigger: !!element?.closest('.printer-trigger'),
    }
  }, { px: x, py: y })
}

function center(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// A scrim dismiss is a pointer press that BOTH starts and ends on the backdrop (useScrimDismiss), not a
// click, and is ignored for 200ms after a window focus. Press the BOTTOM-LEFT backdrop: clear of the
// centered modal box AND below the header (which now sits on top of the scrim), after a short settle.
async function dismissModalBackdrop(page: Page): Promise<void> {
  const scrim = page.locator('.modal-scrim').last()
  const box = await scrim.boundingBox()
  if (!box) return
  await page.waitForTimeout(260)
  await page.mouse.move(box.x + 14, box.y + box.height - 40)
  await page.mouse.down()
  await page.mouse.up()
}

test.describe('header printer dropdown: real geometry + stacking canaries', () => {
  var app: ElectronApplication
  var page: Page
  var daemon: StubDaemon

  test.beforeAll(async () => {
    test.setTimeout(60_000)
    const userData = mkdtempSync(join(tmpdir(), 'b3-dropdown-'))
    daemon = await startStubDaemon(BETA_DAEMON_VERSION)
    seedPrinters(userData, daemon)
    app = await electron.launch({ executablePath: packagedBinary(), args: [`--user-data-dir=${userData}`], env: appEnv() })
    page = await rendererWindow(app)
    await app.evaluate(({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL().includes('index.html'))
      if (win) win.setContentSize(size.width, size.height)
    }, WINDOW)
    await page.locator('.printer-trigger').waitFor({ timeout: 30_000 })
    await page.waitForTimeout(300)
  })

  test.afterAll(async () => {
    await app?.close()
    await daemon?.stop()
  })

  test('the status dot is anchored on the avatar bottom-right corner (real layout)', async () => {
    const avatar = await page.locator('.printer-trigger .printer-avatar').boundingBox()
    const dot = await page.locator('.printer-trigger .status-dot').boundingBox()
    expect(avatar, 'avatar present').not.toBeNull()
    expect(dot, 'status dot present').not.toBeNull()
    const dotCenter = center(dot as Box), avatarBox = avatar as Box
    expect(dotCenter.x, 'dot in the right half of the avatar').toBeGreaterThan(avatarBox.x + avatarBox.width / 2)
    expect(dotCenter.y, 'dot in the bottom half of the avatar').toBeGreaterThan(avatarBox.y + avatarBox.height / 2)
    expect(Math.abs(dotCenter.x - (avatarBox.x + avatarBox.width)), 'dot hugs the avatar right edge').toBeLessThan(avatarBox.width / 2)
    expect(Math.abs(dotCenter.y - (avatarBox.y + avatarBox.height)), 'dot hugs the avatar bottom edge').toBeLessThan(avatarBox.height / 2)
  })

  test('the open menu lists every printer and paints on top of the page content', async () => {
    await openMenu(page)
    await expect(page.locator('.printer-menu')).toContainText('Alpha')
    await expect(page.locator('.printer-menu')).toContainText('Beta')
    // There must be store content behind the menu for "paints on top" to mean anything.
    expect(await page.locator('.plugin-grid .card').count(), 'store has cards behind the menu').toBeGreaterThan(0)
    const betaRow = page.locator('.printer-menu .printer-row', { hasText: 'Beta' })
    const rowCenter = center((await betaRow.boundingBox()) as Box)
    expect((await surfaceAt(page, rowCenter.x, rowCenter.y)).inMenu,
      'the menu owns its own pixels at the printer row (on top of content)').toBe(true)
    // The store-over-dropdown bug shows up LOWER, where the menu drops into the card grid - probe the
    // bottom of the menu, not just the row near the top (a card definitely sits behind here).
    const menuBox = (await page.locator('.printer-menu').boundingBox()) as Box
    expect((await surfaceAt(page, menuBox.x + menuBox.width / 2, menuBox.y + menuBox.height - 12)).inMenu,
      'the menu owns its own pixels at its BOTTOM edge, over the card grid').toBe(true)
    await page.locator('.printer-trigger').click()
    await page.locator('.printer-menu').waitFor({ state: 'hidden' })
  })

  test('the notification panel paints on top of the store content', async () => {
    const bell = page.locator('.notif-bell')
    await expect(bell).toBeVisible()
    await bell.click()
    const panel = page.locator('.notif-panel')
    await panel.waitFor({ state: 'visible' })
    expect(await page.locator('.plugin-grid .card').count(), 'store has cards behind the panel').toBeGreaterThan(0)
    const panelBox = (await panel.boundingBox()) as Box
    const owner = await page.evaluate(({ px, py }) => {
      const element = document.elementFromPoint(px, py)

      return { inPanel: !!element?.closest('.notif-panel') }
    }, { px: panelBox.x + panelBox.width / 2, py: panelBox.y + panelBox.height - 12 })
    expect(owner.inPanel, 'the notification panel owns its own pixels over the card grid').toBe(true)
    // Dismiss via the transparent backdrop scrim so later tests start clean. Teardown is best-effort:
    // a scrim that already went away is not a failure of this assertion, but it gets logged, never swallowed.
    await page.locator('.notif-scrim').click({ position: { x: 5, y: 700 } })
      .catch((reason) => console.warn('scrim dismiss skipped:', reason))
    await panel.waitFor({ state: 'hidden' })
      .catch((reason) => console.warn('notification panel did not hide:', reason))
  })

  test('a menu row is clickable through the real stack and switches the selected printer', async () => {
    await openMenu(page)
    await page.locator('.printer-menu .printer-row', { hasText: 'Beta' }).click()
    await expect(page.locator('.printer-trigger .nick')).toHaveText('Beta')
    await page.locator('.printer-menu').waitFor({ state: 'hidden' })
  })

  // The requirement: the dropdown is global navigation and MUST stay on top of an open modal shade. Open a
  // modal from the dropdown (which closes the menu), then confirm the trigger is still the TOP surface over
  // the scrim, open the menu OVER the modal and confirm it wins the stack, and that the scrim still
  // dismisses from a backdrop press in the content area below the header.
  test('the printer dropdown stays on top of an open modal shade (and the backdrop still dismisses)', async () => {
    await openMenu(page)
    await page.locator('.printer-menu .menu-action', { hasText: 'Add a printer' }).click()
    const scrim = page.locator('.modal-scrim')
    await expect(scrim).toBeVisible()

    const triggerCenter = center((await page.locator('.printer-trigger').boundingBox()) as Box)
    expect((await surfaceAt(page, triggerCenter.x, triggerCenter.y)).inTrigger,
      'the trigger stays on top of the modal scrim, so the switcher is still reachable').toBe(true)

    await page.locator('.printer-trigger').click()
    await page.locator('.printer-menu').waitFor({ state: 'visible' })
    const rowCenter = center((await page.locator('.printer-menu .printer-row', { hasText: 'Beta' }).boundingBox()) as Box)
    expect((await surfaceAt(page, rowCenter.x, rowCenter.y)).inMenu,
      'the open menu wins the stack over the modal scrim').toBe(true)

    await page.locator('.printer-trigger').click()
    await page.locator('.printer-menu').waitFor({ state: 'hidden' })
    await dismissModalBackdrop(page)
    await expect(scrim).toBeHidden()
  })

  // The daemon-update affordance renders for the behind printer and opens its confirm modal. It is a
  // PER-ROW callout, not a menu footer action: this test used to look for `.menu-action.update-daemon`,
  // which menu-actions.tsx stopped rendering when daemon/jinni updates moved onto the row they belong
  // to (only the orphaned CSS rule was left behind). The callout is gated on a MANAGED grade
  // (data/printers/updates.ts), which is why this spec now runs a stub daemon: the app has to probe a
  // daemon that answers before there is anything to click. Last, since the confirm modal is left for
  // afterAll to tear down.
  test('the daemon-update action appears for a behind printer and opens a modal', async () => {
    await openMenu(page)
    // The callout is a SIBLING of the selection button, both inside .printer-row-wrap.
    const betaRow = page.locator('.printer-menu .printer-row-wrap', { hasText: 'Beta' })
    const updateAction = betaRow.locator('.printer-update-callout.daemon')
    // Generous, because what is being waited on is the app's own probe of the stub daemon landing.
    await expect(updateAction).toBeVisible({ timeout: 20_000 })
    await updateAction.click()
    await expect(page.locator('.modal-scrim')).toBeVisible()
  })
})
