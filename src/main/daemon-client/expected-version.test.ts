// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const storedSettings = vi.hoisted(() => ({ values: {} as Record<string, unknown> }))
const shippedCatalogue = vi.hoisted(() => ({ dir: '' }))

vi.mock('../settings', () => ({
  loadSettings: () => storedSettings.values,
  saveSettings: (patch: Record<string, unknown>) => { storedSettings.values = { ...storedSettings.values, ...patch } },
}))

vi.mock('../registry/bundled-dir', () => ({ bundledRegistryDir: () => shippedCatalogue.dir }))

import { expectedDaemonVersion } from './expected-version'
import { DAEMON_PACKAGE } from './version'

const SHIPPED_DAEMON = '0.12.25'

beforeEach(() => {
  storedSettings.values = {}
  shippedCatalogue.dir = mkdtempSync(join(tmpdir(), 'b3d-shipped-'))
  writeFileSync(join(shippedCatalogue.dir, 'index.json'), JSON.stringify({ plugins: [{ name: DAEMON_PACKAGE, version: SHIPPED_DAEMON }] }))
})

afterEach(() => {
  rmSync(shippedCatalogue.dir, { recursive: true, force: true })
})

// The version a managed printer is checked against after an upload. It has to follow the daemon the app
// would actually install, or the check refuses a printer that is running exactly what it was given.
describe('the daemon version this app would install', () => {
  it('is the published one once a list has offered a daemon newer than the build ships', () => {
    storedSettings.values = { offeredSystemVersions: { [DAEMON_PACKAGE]: '0.12.26' } }

    expect(expectedDaemonVersion()).toBe('0.12.26')
  })

  it('is the shipped one when the published lists are behind the build', () => {
    storedSettings.values = { offeredSystemVersions: { [DAEMON_PACKAGE]: '0.12.24' } }

    expect(expectedDaemonVersion()).toBe(SHIPPED_DAEMON)
  })

  it('is the shipped one on a machine that has never read a published list', () => {
    expect(expectedDaemonVersion()).toBe(SHIPPED_DAEMON)
  })
})
