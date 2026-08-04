// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { installBlockReason } from './install-gate'
import type { InstallBlockInput } from './install-gate'

// Echo the key plus any params so a test can assert which branch fired and that params flowed through.
function t(key: string, params?: Record<string, string | number>): string {
  return params ? `${key} ${JSON.stringify(params)}` : key
}

const READY: InstallBlockInput = {
  printerId: 'p1', configReady: true, missingFields: [], portProblem: null,
  conflicts: [], printActive: false, blockedActions: [],
}

describe('installBlockReason', () => {
  it('returns null when nothing blocks install', () => {
    expect(installBlockReason(t, READY)).toBeNull()
  })

  it('reports a print in progress first, above every other block, naming the blocked services', () => {
    const block = installBlockReason(t, { ...READY, printerId: undefined, conflicts: ['x'], configReady: false, printActive: true, blockedActions: ['restart-klipper', 'restart-display'] })
    expect(block?.brief).toContain('store.block.print.brief')
    expect(block?.detail).toContain('Klipper')
    expect(block?.detail).toContain('store.blocked_action.display')
  })

  it('reports a missing printer when none is selected', () => {
    expect(installBlockReason(t, { ...READY, printerId: undefined })?.brief).toBe('store.block.no_printer.brief')
  })

  it('reports a conflict and names the conflicting plugins', () => {
    const block = installBlockReason(t, { ...READY, conflicts: ['force-bed-mesh'] })
    expect(block?.brief).toContain('store.block.conflicts.brief')
    expect(block?.brief).toContain('force-bed-mesh')
  })

  it('reports incomplete config, names the fields, and offers the configure action', () => {
    const block = installBlockReason(t, { ...READY, configReady: false, missingFields: ['Spoolman server address'] })
    expect(block?.action).toBe('configure')
    expect(block?.detail).toContain('Spoolman server address')
  })

  it('names the port that cannot be used as the brief', () => {
    const block = installBlockReason(t, { ...READY, portProblem: { key: 'store.port_reserved', params: { port: 7125 } } })
    expect(block?.brief).toBe('store.port_reserved {"port":7125}')
  })
})
