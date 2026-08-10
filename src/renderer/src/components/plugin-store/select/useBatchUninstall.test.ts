// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
// Select-several-and-remove reaches every card in the grid, so it is the second way the daemon or the
// adapter's jinni could be taken off a printer that needs them to stay enrolled.
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBatchUninstall } from './useBatchUninstall'
import { makePlugin } from '../../../test/fixtures'

const DAEMON = makePlugin({ id: 'bespok3d-daemon', name: 'bespok3d-daemon', systemPackage: true })
const JINNI = makePlugin({ id: 'bespok3d-jinni-snapmaker-u1', name: 'bespok3d-jinni-snapmaker-u1', systemPackage: true })
const ORDINARY_PLUGIN = makePlugin({ id: 'idle-timeout', name: 'idle-timeout' })

function uninstallableFrom(plugins: ReturnType<typeof makePlugin>[]): string[] {
  const { result } = renderHook(() => useBatchUninstall({
    plugins,
    installedIds: plugins.map((plugin) => plugin.id),
    printerId: 'printer-0001',
  }))

  return result.current.uninstallableIds
}

describe('what a removal set may contain', () => {
  it('never offers the daemon or the jinni, however the printer lists them', () => {
    expect(uninstallableFrom([DAEMON, JINNI, ORDINARY_PLUGIN])).toEqual(['idle-timeout'])
  })

  it('still offers every ordinary plugin the printer has', () => {
    const alsoInstalled = makePlugin({ id: 'spoolman', name: 'spoolman' })

    expect(uninstallableFrom([ORDINARY_PLUGIN, alsoInstalled])).toEqual(['idle-timeout', 'spoolman'])
  })
})
