// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ElectronApplication, Page } from '@playwright/test'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

// Shared launch helpers for the screenshot/E2E specs: locate the packaged app, strip the sandbox's
// forced ELECTRON_RUN_AS_NODE, grab the renderer window, and shoot a plain-artifact screenshot.
export const RELEASE_DIR = join(__dirname, '../dist/release')
export const SHOTS_DIR = join(__dirname, '../../screenshots')

// arm64 is what the tests exercise because arm64 is the supported target: Apple is winding Rosetta
// down, and the x64 build only exists so people on older Macs still have something to run. Testing
// the x64 build on Apple Silicon would also test Rosetta rather than the app.
export function packagedBinary(): string {
  const arm64Build = readdirSync(RELEASE_DIR).find((entry) => entry === 'mac-arm64')
  if (!arm64Build) throw new Error(`No packaged arm64 mac app under ${RELEASE_DIR}/mac-arm64. Run scripts/e2e.sh or scripts/screenshots.sh.`)
  const binary = join(RELEASE_DIR, arm64Build, 'Bespok3d.app', 'Contents', 'MacOS', 'Bespok3d')
  if (!existsSync(binary)) throw new Error(`Packaged binary not found: ${binary}`)

  return binary
}

// This sandbox forces ELECTRON_RUN_AS_NODE=1, which makes Electron run as plain Node (no app); strip it.
// B3D_AUTOMATED_RUN tells the app it is being driven by this harness. These runs launch the REAL
// packaged binary, so nothing else distinguishes them from a user's install, and without the flag
// every end-to-end run would count itself as one more person using the app.
export function appEnv(): Record<string, string> {
  const clean = { ...process.env } as Record<string, string>
  delete clean.ELECTRON_RUN_AS_NODE

  return { ...clean, B3D_AUTOMATED_RUN: '1' }
}

export function rendererWindow(app: ElectronApplication): Promise<Page> {
  return pollForRendererWindow(app, Date.now() + 20_000)
}

// Poll until the deadline. The awaited timer between attempts is what keeps this stack-safe: each
// attempt resumes on a fresh microtask, so the frames never pile up. Do not remove that await.
async function pollForRendererWindow(app: ElectronApplication, deadline: number): Promise<Page> {
  const found = app.windows().find((page) => page.url().includes('index.html'))
  if (found) return found
  if (Date.now() >= deadline) throw new Error('renderer window did not appear')
  await new Promise((resolve) => setTimeout(resolve, 200))

  return pollForRendererWindow(app, deadline)
}

export async function shoot(window: Page, name: string): Promise<void> {
  await window.waitForTimeout(350)
  await window.screenshot({ path: join(SHOTS_DIR, name) })
}
