// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { deriveStoreView } from './view-model'
import { ALLOW_ALL_CHANNELS } from '../../../data/channels'
import { makePlugin, makePrinter } from '../../../test/fixtures'
import type { Printer } from '../../../data/types'

const NO_FILTERS = {
  query: '', channels: [], categories: [], trusts: [], statuses: [], printerOnly: false,
  grouped: false, sortKey: 'name' as const, sortDir: 'asc' as const,
  ceilingFor: ALLOW_ALL_CHANNELS, disabledChannels: [],
}

const NOTHING_LIVE = { installedIds: null, installedVersions: null, deactivatedIds: null }

const MACHINERY = { 'bespok3d-daemon': '0.12.23', 'bespok3d-jinni-snapmaker-u1': '0.1.10' }

function viewOf(printer: Printer, catalogPlugins = [makePlugin({ id: 'bespok3d-daemon', name: 'bespok3d-daemon' })]) {
  return deriveStoreView({ printer, catalogPlugins, live: NOTHING_LIVE, filters: NO_FILTERS })
}

describe('the printer machinery in the store view', () => {
  // Without this the daemon and the jinni are on the printer but nothing in the store knows it, so both
  // cards offer to install what the printer is already running and neither ever offers its update.
  it('counts the daemon and the jinni as installed, at the versions the printer runs', () => {
    const view = viewOf(makePrinter({ machineryVersions: MACHINERY }))

    expect(view.installedIds).toContain('bespok3d-daemon')
    expect(view.installedIds).toContain('bespok3d-jinni-snapmaker-u1')
    expect(view.installedVersions['bespok3d-daemon']).toBe('0.12.23')
    expect(view.installedVersions['bespok3d-jinni-snapmaker-u1']).toBe('0.1.10')
  })

  // Fed to the orphan pass, machinery with no catalog entry becomes a remove-only card: the app
  // offering to uninstall the daemon from an enrolled printer.
  it('never turns machinery this build has no catalog entry for into a removable card', () => {
    const view = viewOf(makePrinter({ machineryVersions: MACHINERY }))

    expect(view.orphans).toEqual([])
  })

  it('reports no machinery for a printer that is not managed', () => {
    const view = viewOf(makePrinter({ status: 'online', machineryVersions: MACHINERY }))

    expect(view.installedIds).toEqual([])
  })
})

// Every button the store offers runs the plugin install path, and neither the daemon nor the jinni
// places any file that way: a card for either one offers an Update that reports success and leaves the
// printer running what it was running. Enrollment puts them there and the printer's own update moves
// them, so the store does not show them at all.
describe('the store never shows a card for the daemon or the jinni', () => {
  const STORE_CATALOG = [
    makePlugin({ id: 'bespok3d-daemon', name: 'bespok3d-daemon', systemPackage: true }),
    makePlugin({ id: 'bespok3d-jinni-snapmaker-u1', name: 'bespok3d-jinni-snapmaker-u1', systemPackage: true }),
    makePlugin({ id: 'spoolman', name: 'spoolman' }),
  ]

  function shownIds(printer: Printer): string[] {
    return viewOf(printer, STORE_CATALOG).flatPlugins.map((plugin) => plugin.id)
  }

  it('leaves an enrolled printer with the ordinary plugins and nothing else', () => {
    expect(shownIds(makePrinter({ machineryVersions: MACHINERY }))).toEqual(['spoolman'])
  })

  it('shows neither one on a printer that has never been enrolled', () => {
    expect(shownIds(makePrinter({ status: 'online' }))).toEqual(['spoolman'])
  })

  it('still knows which daemon the printer runs, so plugins are gated against it', () => {
    const view = viewOf(makePrinter({ machineryVersions: MACHINERY }), STORE_CATALOG)

    expect(view.installedVersions['bespok3d-daemon']).toBe('0.12.23')
  })
})
