// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { daemonVersionInRegistry, DAEMON_PACKAGE } from './version'

// The version this build expects used to be copied out of a sibling checkout's version.py at build
// time, so it could name a daemon the build does not carry. Reading the shipped catalogue is what
// makes the two the same number by construction, and these guard that read.
describe('daemonVersionInRegistry', () => {
  var registryDir: string

  beforeEach(() => {
    registryDir = mkdtempSync(join(tmpdir(), 'b3d-registry-'))
  })

  afterEach(() => {
    rmSync(registryDir, { recursive: true, force: true })
  })

  function writeCatalogue(plugins: unknown): void {
    writeFileSync(join(registryDir, 'index.json'), JSON.stringify({ plugins }))
  }

  it('names the version of the daemon package this build ships', () => {
    writeCatalogue([{ name: 'spoolman', version: '9.9.9' }, { name: DAEMON_PACKAGE, version: '0.12.23' }])

    expect(daemonVersionInRegistry(registryDir)).toBe('0.12.23')
  })

  // A build with no daemon package cannot install one, so it must not claim a version either: a
  // silent fallback here would let the app promise an update it has no bytes for.
  it('refuses to name a version when the build ships no daemon package', () => {
    writeCatalogue([{ name: 'spoolman', version: '9.9.9' }])

    expect(() => daemonVersionInRegistry(registryDir)).toThrow(/ships no "bespok3d-daemon" package/)
  })

  it('refuses to name a version when the catalogue has no packages at all', () => {
    writeCatalogue(undefined)

    expect(() => daemonVersionInRegistry(registryDir)).toThrow(/ships no "bespok3d-daemon" package/)
  })
})
