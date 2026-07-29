// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'

vi.mock('../daemon-client/client', () => ({ fetchCapabilities: vi.fn(), EXPECTED_DAEMON_VERSION: '0.0.0' }))

import { capsAfterInstall, retainForInstalled, retainRemovalProvenance, recordAppliedVars } from './record-sync'
import { fetchCapabilities } from '../daemon-client/client'
import type { PrinterRecord } from '../printers'

describe('capsAfterInstall', () => {
  const record = { ip: '10.0.0.5', installedVersions: { spoolman: '0.1.0' }, endpoints: [], jinniVersion: '0.1.1', jinniCapabilities: [], jinniExtras: [] } as never

  it('keeps the just-installed plugin recorded when the post-install capabilities fetch fails', async () => {
    vi.mocked(fetchCapabilities).mockRejectedValueOnce(new Error('device unreachable'))
    const caps = await capsAfterInstall(record, 'fluidd', '0.2.0-experiment')
    expect(caps.installedVersions).toEqual({ spoolman: '0.1.0', fluidd: '0.2.0-experiment' })
    expect(caps.installedIds).toContain('fluidd')
  })

  it('uses the live capabilities when the fetch succeeds', async () => {
    vi.mocked(fetchCapabilities).mockResolvedValueOnce({ installed: { fluidd: '0.2.0-experiment' } } as never)
    const caps = await capsAfterInstall(record, 'fluidd', '0.2.0-experiment')
    expect(caps.installedIds).toEqual(['fluidd'])
  })
})

describe('retainForInstalled', () => {
  it('drops the entry for a plugin that is no longer installed', () => {
    const sources = { 'spoolman': 'src-a', 'rfid-ntag': 'src-a' }
    expect(retainForInstalled(sources, ['rfid-ntag'])).toEqual({ 'rfid-ntag': 'src-a' })
  })

  it('drops cascade-removed dependents too, keeping only what is still installed', () => {
    const sources = { 'a': 'src', 'b': 'src', 'c': 'src' }
    expect(retainForInstalled(sources, ['a'])).toEqual({ 'a': 'src' })
  })

  it('is safe when the record had no map', () => {
    expect(retainForInstalled(undefined, ['a'])).toEqual({})
  })
})

describe('retainRemovalProvenance', () => {
  it('prunes the applied-vars record with the rest of the provenance on uninstall', () => {
    const record = {
      installedIds: ['spoolman', 'fluidd'],
      installedSources: { spoolman: 'src', fluidd: 'src' },
      installedChannels: { spoolman: 'stable', fluidd: 'stable' },
      installLogs: { spoolman: { pluginId: 'spoolman', timestamp: 1, ok: true, phases: [] } },
      appliedPluginVars: { spoolman: { SPOOLMAN_SERVER: 'http://x' }, fluidd: { FLUIDD_PORT: '80' } },
      appliedPluginVarsAt: { spoolman: '2026-07-02T10:00:00.000Z', fluidd: '2026-07-02T10:00:00.000Z' },
    } as unknown as PrinterRecord

    const pruned = retainRemovalProvenance(record, ['spoolman'])

    expect(pruned.appliedPluginVars).toEqual({ spoolman: { SPOOLMAN_SERVER: 'http://x' } })
    expect(pruned.appliedPluginVarsAt).toEqual({ spoolman: '2026-07-02T10:00:00.000Z' })
    expect(pruned.installedSources).toEqual({ spoolman: 'src' })
  })

  // Uninstalling a plugin takes its last failed attempt with it, so a later fresh install starts clean.
  // A plugin that is not installed because it never installed keeps its reason: that is the whole point
  // of the record, so failures can never be pruned to the installed set the way provenance is.
  it('drops the failed attempt of the plugin that was just uninstalled and keeps the others', () => {
    const failedInstallLogs = {
      fluidd: { pluginId: 'fluidd', timestamp: 1, ok: false, phases: [] },
      camera: { pluginId: 'camera', timestamp: 2, ok: false, phases: [] },
    }
    const record = { installedIds: ['spoolman', 'fluidd'], failedInstallLogs } as unknown as PrinterRecord

    expect(Object.keys(retainRemovalProvenance(record, ['spoolman']).failedInstallLogs)).toEqual(['camera'])
  })
})

describe('recordAppliedVars', () => {
  const record = {
    appliedPluginVars: { fluidd: { FLUIDD_PORT: '80' } },
    appliedPluginVarsAt: { fluidd: '2026-07-01T09:00:00.000Z' },
  } as unknown as PrinterRecord

  it('records the sent vars and timestamp for the plugin, keeping other plugins entries', () => {
    const applied = recordAppliedVars(record, 'spoolman', { SPOOLMAN_SERVER: 'http://x' }, '2026-07-02T10:00:00.000Z')
    expect(applied.appliedPluginVars).toEqual({ fluidd: { FLUIDD_PORT: '80' }, spoolman: { SPOOLMAN_SERVER: 'http://x' } })
    expect(applied.appliedPluginVarsAt).toEqual({ fluidd: '2026-07-01T09:00:00.000Z', spoolman: '2026-07-02T10:00:00.000Z' })
  })

  it('records an install that sent no vars as the empty map (a truthful "we sent nothing")', () => {
    const applied = recordAppliedVars(record, 'cpu-temp', undefined, '2026-07-02T10:00:00.000Z')
    expect(applied.appliedPluginVars['cpu-temp']).toEqual({})
  })

  it('overwrites the plugin previous entry on a re-send', () => {
    const applied = recordAppliedVars(record, 'fluidd', { FLUIDD_PORT: '81' }, '2026-07-02T10:00:00.000Z')
    expect(applied.appliedPluginVars.fluidd).toEqual({ FLUIDD_PORT: '81' })
    expect(applied.appliedPluginVarsAt.fluidd).toBe('2026-07-02T10:00:00.000Z')
  })
})
