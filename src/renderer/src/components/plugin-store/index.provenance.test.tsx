// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
// Where an installed copy came from is the app's own record: the printer knows the version it runs and
// nothing about the listing it was taken from. So the store's re-sync has to re-read the saved record,
// not just ask the printer. Without it, a plugin installed from a locally packed build goes on counting
// as the published one for as long as the app stays open, and update-all pushes the published build
// back onto the printer.
import { describe, it, expect, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeIndexEntry, makePrinter, makeCapabilities } from '../../test/fixtures'
import type { Printer } from '../../data/types'
import { PluginStore } from '.'

const LOCAL_BUILD = '/Users/dev/Bespok3d/dist/plugins/index.json'

// The store hands out patches as updaters; this is the printer list they add up to.
function printersAfter(onPrinterUpdate: ReturnType<typeof vi.fn>): Printer[] {
  return onPrinterUpdate.mock.calls.reduce((printers, [updater]) => updater(printers), [makePrinter({ status: 'managed' })])
}

describe('where the store says an installed copy came from', () => {
  it('takes the source of each installed copy from the saved record, not from the printer', async () => {
    const saved = { ...makePrinter({ status: 'managed' }), installedSources: { 'demo-a': LOCAL_BUILD }, installedChannels: { 'demo-a': 'stable' as const } }
    const onPrinterUpdate = vi.fn()
    setup(
      <PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} onPrinterUpdate={onPrinterUpdate} />,
      {
        withCatalog: true,
        catalog: [makeIndexEntry({ name: 'demo-a', title: 'Alpha', version: '1.0.0' })],
        b3d: {
          printers: { load: vi.fn().mockResolvedValue([saved]) },
          store: { capabilities: vi.fn().mockResolvedValue(makeCapabilities({ 'demo-a': '0.9.0' })) },
        },
      },
    )

    await waitFor(() => expect(printersAfter(onPrinterUpdate)[0].installedSources).toEqual({ 'demo-a': LOCAL_BUILD }))
    expect(printersAfter(onPrinterUpdate)[0].installedChannels).toEqual({ 'demo-a': 'stable' })
  })

  it('leaves the sources it already has alone when there is no saved record to read', async () => {
    const onPrinterUpdate = vi.fn()
    setup(
      <PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} onPrinterUpdate={onPrinterUpdate} />,
      {
        withCatalog: true,
        catalog: [makeIndexEntry({ name: 'demo-a', title: 'Alpha', version: '1.0.0' })],
        b3d: {
          printers: { load: vi.fn().mockResolvedValue([]) },
          store: { capabilities: vi.fn().mockResolvedValue(makeCapabilities({ 'demo-a': '0.9.0' })) },
        },
      },
    )

    await waitFor(() => expect(onPrinterUpdate).toHaveBeenCalled())
    expect(printersAfter(onPrinterUpdate)[0].installedSources).toBeUndefined()
  })
})
