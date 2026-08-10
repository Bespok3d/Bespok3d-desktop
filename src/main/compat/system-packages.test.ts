// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { markSystemPackages, systemPackageNames, runningMachineryVersions } from './system-packages'
import type { Catalog } from '../registry'
import type { MergedEntry } from '../registry/model'

const SNAPMAKER_ADAPTER = { jinniPackage: 'bespok3d-jinni-snapmaker-u1' }

function entry(name: string, claimed?: boolean): MergedEntry {
  return { name, system_package: claimed } as MergedEntry
}

function catalogOf(entries: MergedEntry[]): Catalog {
  return { plugins: entries } as Catalog
}

function markedNames(entries: MergedEntry[]): string[] {
  return markSystemPackages(catalogOf(entries), [SNAPMAKER_ADAPTER])
    .plugins.filter((plugin) => plugin.system_package)
    .map((plugin) => plugin.name)
}

describe('which packages are the printer machinery', () => {
  it('names the daemon and every registered adapter jinni', () => {
    const names = systemPackageNames([SNAPMAKER_ADAPTER, { jinniPackage: 'bespok3d-jinni-other' }])

    expect([...names].sort()).toEqual(['bespok3d-daemon', 'bespok3d-jinni-other', 'bespok3d-jinni-snapmaker-u1'])
  })

  it('marks the daemon and the jinni in the catalog the renderer is handed', () => {
    expect(markedNames([entry('bespok3d-daemon'), entry('spoolman'), entry('bespok3d-jinni-snapmaker-u1')]))
      .toEqual(['bespok3d-daemon', 'bespok3d-jinni-snapmaker-u1'])
  })

  it('leaves an ordinary plugin removable', () => {
    expect(markedNames([entry('spoolman'), entry('camera-hw-accel')])).toEqual([])
  })

  // Without this a published list could hand its own plugin a card with no way to remove it, just by
  // writing one field. What this build carries decides, not what a list claims about itself.
  it('refuses a published list that claims the mark for its own plugin', () => {
    expect(markedNames([entry('a-list-that-lies', true)])).toEqual([])
  })

  it('does not mark an adapter jinni this build has no adapter for', () => {
    expect(markedNames([entry('bespok3d-jinni-someone-elses-printer')])).toEqual([])
  })
})

const REGISTERED = [{ id: 'snapmaker-u1', jinniPackage: 'bespok3d-jinni-snapmaker-u1' }]

describe('what the machinery on a printer is running', () => {
  it('keys the daemon and the jinni by the package names the store looks them up under', () => {
    const running = runningMachineryVersions({ adapter: 'snapmaker-u1', daemonVersion: '0.12.23', jinniVersion: '0.1.10' }, REGISTERED)

    expect(running).toEqual({ 'bespok3d-daemon': '0.12.23', 'bespok3d-jinni-snapmaker-u1': '0.1.10' })
  })

  it('leaves out the jinni of a printer whose adapter this build does not carry', () => {
    const running = runningMachineryVersions({ adapter: 'someone-elses-printer', daemonVersion: '0.12.23', jinniVersion: '0.1.10' }, REGISTERED)

    expect(running).toEqual({ 'bespok3d-daemon': '0.12.23' })
  })

  // An entry with no real version reads as installed-at-nothing, which makes any catalog version look
  // newer and hangs a permanent Update on a card that may be perfectly current.
  it('reports nothing for a version the printer did not give', () => {
    const running = runningMachineryVersions({ adapter: 'snapmaker-u1', daemonVersion: '', jinniVersion: 'unknown' }, REGISTERED)

    expect(running).toEqual({})
  })
})
