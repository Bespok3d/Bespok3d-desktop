// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MergedEntry } from './model'

const storedSettings = vi.hoisted(() => ({ values: {} as Record<string, unknown> }))

vi.mock('../settings', () => ({
  loadSettings: () => storedSettings.values,
  saveSettings: (patch: Record<string, unknown>) => { storedSettings.values = { ...storedSettings.values, ...patch } },
}))

import { stampOfferedSystemVersions, installableVersion, forgetOfferedSystemVersion, rememberOfferedSystemVersion } from './offered-versions'

const DAEMON = 'bespok3d-daemon'
const JINNI = 'bespok3d-jinni-snapmaker-u1'

function listed(name: string, version: string, isMachinery: boolean): MergedEntry {
  return { name, version, system_package: isMachinery } as unknown as MergedEntry
}

beforeEach(() => {
  storedSettings.values = {}
})

// The daemon and the jinni are released as their own signed packages so a fix reaches printers without
// an app release behind it. Before this, the app could only ever name what was inside its own build, so
// a released daemon 0.12.26 was invisible to every installed app until the next app release carried it.
describe('the version this app would install for the printer machinery', () => {
  it('is the published one when the lists offer something newer than the build ships', () => {
    stampOfferedSystemVersions([listed(DAEMON, '0.12.26', true), listed(JINNI, '0.1.11', true)])

    expect(installableVersion(DAEMON, '0.12.25')).toBe('0.12.26')
    expect(installableVersion(JINNI, '0.1.10')).toBe('0.1.11')
  })

  it('is the shipped one when the published lists are behind the build', () => {
    stampOfferedSystemVersions([listed(DAEMON, '0.12.24', true)])

    expect(installableVersion(DAEMON, '0.12.25')).toBe('0.12.25')
  })

  it('is the shipped one on a machine that has never read a published list', () => {
    expect(installableVersion(DAEMON, '0.12.25')).toBe('0.12.25')
  })
})

describe('what a list pass writes down', () => {
  it('takes only the entries this build calls machinery, never a plugin claiming to be one', () => {
    stampOfferedSystemVersions([listed('spoolman', '9.9.9', false), listed(DAEMON, '0.12.26', true)])

    expect(storedSettings.values.offeredSystemVersions).toEqual({ [DAEMON]: '0.12.26' })
  })

  it('leaves the daemon offer alone while moving the jinni one', () => {
    stampOfferedSystemVersions([listed(DAEMON, '0.12.26', true), listed(JINNI, '0.1.11', true)])
    stampOfferedSystemVersions([listed(JINNI, '0.1.12', true)])

    expect(installableVersion(DAEMON, '0.12.25')).toBe('0.12.26')
    expect(installableVersion(JINNI, '0.1.10')).toBe('0.1.12')
  })
})

// What the app just installed, written down at the moment the bytes were opened: the deploy path
// reads the published lists for itself, so a printer can be handed a published daemon by a pass that
// never went through a list read here.
describe('an offer the app has just acted on', () => {
  it('is what the app names from then on, with no list read in between', () => {
    rememberOfferedSystemVersion(DAEMON, '0.12.26')

    expect(installableVersion(DAEMON, '0.12.25')).toBe('0.12.26')
  })
})

// Forgetting an offer the app could not act on: the download failed, the printer got the copy in the
// build, and every version the app names has to say so, or the check after the upload refuses a daemon
// that is on the printer and working.
describe('an offer the app could not act on', () => {
  it('is dropped for that package alone, and the other machinery keeps its offer', () => {
    stampOfferedSystemVersions([listed(DAEMON, '0.12.26', true), listed(JINNI, '0.1.11', true)])

    forgetOfferedSystemVersion(DAEMON)

    expect(installableVersion(DAEMON, '0.12.25')).toBe('0.12.25')
    expect(installableVersion(JINNI, '0.1.10')).toBe('0.1.11')
  })
})
