// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { packagedBinary, appEnv, rendererWindow } from './app-launch'
import { EXPECTED_DAEMON_VERSION } from '../src/main/daemon-client/version'

// Real-layout geometry canaries for the plugin detail modal, driven against the REAL packaged app via
// Playwright-electron. Chromium does true CSS layout; jsdom (the vitest cage) does not, which is exactly
// why the close-X misposition and the modal-overflow bug both shipped GREEN under the cage. See
// doc/codebase-fix/cleanup-audit.md section 7 ("jsdom has no layout engine ... Top gap").
//
// These assert WHERE things render (computed getBoundingClientRect geometry), not pixels, so there is no
// cross-platform baseline to flake. They are the regression net the layout-blocked stages (shared
// Modal J, primitives K, CSS de-dup L, dead-CSS M) refactor against: the companion jsdom test
// PluginPanel.layout.test.tsx locks the modal STRUCTURE (single scroll region, sibling footer,
// direct-child X); this locks the resulting GEOMETRY so a CSS/specificity regression cannot slip past.
//
// The canaries assert the 2026-06-13 modal fixes, which are all MODAL-RELATIVE / height invariants
// (X anchored top-right of the modal; the modal never taller than the viewport or its dvh clamp; a long
// tab cannot grow it; the footer pinned flush to the modal bottom; one scroll region owns the overflow).
// The window is kept small so a long tab actually hits the max-height clamp and the scroll engages.
// A further invariant - the modal sitting fully WITHIN the viewport - is enforced at the bottom now that
// the shared <Modal> scrim is viewport-fixed (stage J).
//
// Off the default check.sh gate (heavy: needs the packaged app). Runs via scripts/e2e.sh
// (./scripts/check.sh e2e), which builds + packages the app first so the geometry reflects current source.

const WINDOW = { width: 1000, height: 640 } // above the app min (900x600); small enough that long tabs clamp
const EPS = 1.5 // sub-pixel tolerance (the test display runs at devicePixelRatio 2)
const FOOT_FLUSH = 2 // the footer sits flush to the modal bottom within this many px

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

interface Box { x: number; y: number; width: number; height: number; right: number; bottom: number }
interface Geometry {
  win: { width: number; height: number }
  modal: Box | null; close: Box | null; head: Box | null; tabs: Box | null; scroll: Box | null; foot: Box | null
  maxHeight: number; scrollOverflowY: string | null; scrollMetrics: { scrollHeight: number; clientHeight: number } | null
}

function readGeometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    function box(el: Element | null): Box | null {
      if (!el) return null
      const rect = el.getBoundingClientRect()

      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
    }
    const modal = document.querySelector('.plugin-modal') as HTMLElement | null
    const scroll = document.querySelector('.plugin-modal .panel-scroll') as HTMLElement | null

    return {
      win: { width: window.innerWidth, height: window.innerHeight },
      modal: box(modal),
      close: box(document.querySelector('.plugin-modal > .panel-close')),
      head: box(document.querySelector('.plugin-modal .panel-head')),
      tabs: box(document.querySelector('.plugin-modal .panel-tabs')),
      scroll: box(scroll),
      foot: box(document.querySelector('.plugin-modal .panel-foot')),
      maxHeight: modal ? parseFloat(getComputedStyle(modal).maxHeight) || Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY,
      scrollOverflowY: scroll ? getComputedStyle(scroll).overflowY : null,
      scrollMetrics: scroll ? { scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight } : null,
    }
  })
}

// Walk every tab (or run once when the plugin renders a single-tab modal), re-measuring on each.
async function eachTab(page: Page, visit: (geometry: Geometry, label: string) => Promise<void>): Promise<void> {
  const tabs = page.locator('.plugin-modal .panel-tab')
  const count = await tabs.count()
  const indices = Array.from({ length: Math.max(count, 1) }, (_unused, index) => index)
  await indices.reduce((chain, index) => chain.then(async () => {
    const label = count === 0 ? 'single' : ((await tabs.nth(index).innerText()).trim() || `tab-${index}`)
    if (count > 0) {
      await tabs.nth(index).click()
      await page.waitForTimeout(150)
    }
    await visit(await readGeometry(page), label)
  }), Promise.resolve())
}

test.describe('plugin detail modal: real-layout geometry canaries', () => {
  var app: ElectronApplication
  var page: Page

  test.beforeAll(async () => {
    test.setTimeout(60_000)
    const userData = mkdtempSync(join(tmpdir(), 'b3-layout-'))
    seedManagedPrinter(userData)
    app = await electron.launch({ executablePath: packagedBinary(), args: [`--user-data-dir=${userData}`], env: appEnv() })
    page = await rendererWindow(app)
    await app.evaluate(({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL().includes('index.html'))
      if (win) win.setContentSize(size.width, size.height)
    }, WINDOW)
    await page.waitForTimeout(400)
    await page.locator('.card-title').first().waitFor({ timeout: 30_000 })
    await page.getByPlaceholder('Search plugins…').fill('spool')
    await page.waitForTimeout(300)
    await page.locator('.card-title', { hasText: 'Spoolman' }).first().click()
    await page.locator('.plugin-modal').waitFor({ timeout: 10_000 })
    await page.waitForTimeout(300)
  })

  test.afterAll(async () => {
    await app?.close()
  })

  test('close X is anchored to the modal top-right (not the top-left bug)', async () => {
    const geometry = await readGeometry(page)
    expect(geometry.modal, 'modal present').not.toBeNull()
    expect(geometry.close, 'close button present').not.toBeNull()
    const modal = geometry.modal as Box, close = geometry.close as Box
    expect(close.x, 'close in the right half of the modal').toBeGreaterThan(modal.x + modal.width / 2)
    expect(modal.right - close.right, 'close flush to the modal right edge').toBeLessThan(40)
    expect(close.y - modal.y, 'close near the modal top').toBeLessThan(48)
  })

  test('modal is never taller than the viewport and honors its dvh max-height clamp', async () => {
    const geometry = await readGeometry(page)
    const modal = geometry.modal as Box
    expect(modal.height, 'modal no taller than the window').toBeLessThanOrEqual(geometry.win.height + EPS)
    expect(modal.height, 'modal honors its max-height clamp').toBeLessThanOrEqual(geometry.maxHeight + EPS)
    expect(modal.width, 'modal no wider than the window').toBeLessThanOrEqual(geometry.win.width + EPS)
  })

  test('no tab can grow the modal past its clamp (the single scroll region absorbs long content)', async () => {
    await eachTab(page, async (geometry, label) => {
      const modal = geometry.modal as Box
      expect(modal.height, `modal on "${label}" no taller than the window`).toBeLessThanOrEqual(geometry.win.height + EPS)
      expect(modal.height, `modal on "${label}" honors its max-height clamp`).toBeLessThanOrEqual(geometry.maxHeight + EPS)
    })
  })

  test('footer stays pinned flush to the modal bottom on every tab', async () => {
    await eachTab(page, async (geometry, label) => {
      expect(geometry.foot, `footer present on "${label}"`).not.toBeNull()
      const modal = geometry.modal as Box, foot = geometry.foot as Box
      expect(Math.abs(foot.bottom - modal.bottom), `footer flush to modal bottom on "${label}"`).toBeLessThanOrEqual(FOOT_FLUSH)
    })
  })

  test('one scroll region sits between the fixed head/tabs and the pinned footer and owns the overflow', async () => {
    // Walk to the tab whose content actually overflows so the scroll-ownership check has teeth, then assert.
    const overflowing = await measureOverflowingTab(page)
    expect(['auto', 'scroll'], 'scroll region owns overflow-y').toContain(overflowing.scrollOverflowY)
    const scroll = overflowing.scroll as Box, foot = overflowing.foot as Box
    const aboveEdge = overflowing.tabs ? overflowing.tabs.bottom : (overflowing.head as Box).bottom
    expect(scroll.y, 'scroll starts below the fixed head/tabs').toBeGreaterThanOrEqual(aboveEdge - EPS)
    expect(scroll.bottom, 'scroll ends above the pinned footer').toBeLessThanOrEqual(foot.y + EPS)
    const metrics = overflowing.scrollMetrics
    expect(metrics, 'scroll metrics present').not.toBeNull()
    expect((metrics as { scrollHeight: number }).scrollHeight,
      'long content overflows the scroll region (not the modal)').toBeGreaterThan((metrics as { clientHeight: number }).clientHeight)
  })

  // FIXED in stage J: `.modal-scrim` was `position: absolute` inside `.store` (offset ~119px below the
  // header) while the modal clamps to `100dvh - 2*space-6`, so a content-clamped modal centered in the
  // header-offset region and its bottom fell below the viewport at small window heights (repro: 1000x640,
  // open Spoolman -> a long tab -> modal bottom ~676 > window 640). The scrim is now viewport-fixed.
  test('modal sits fully within the viewport (top on-screen, bottom not below the fold)', async () => {
    const geometry = await readGeometry(page)
    const modal = geometry.modal as Box
    expect(modal.y).toBeGreaterThanOrEqual(-EPS)
    expect(modal.bottom).toBeLessThanOrEqual(geometry.win.height + EPS)
  })
})

// Click through the tabs and return the geometry of the tab whose scroll region overflows the most, so the
// scroll-ownership canary measures a tab that genuinely has more content than fits (clamped modal).
function overflowOf(candidate: Geometry): number {
  return candidate.scrollMetrics ? candidate.scrollMetrics.scrollHeight - candidate.scrollMetrics.clientHeight : -1
}

async function measureOverflowingTab(page: Page): Promise<Geometry> {
  const measured: Geometry[] = []
  await eachTab(page, async (geometry) => {
    measured.push(geometry)
  })

  return measured.reduce((best, candidate) => (overflowOf(candidate) > overflowOf(best) ? candidate : best))
}
