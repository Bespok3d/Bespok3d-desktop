// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { firstOverlapRefusal, sharedEntryRefusal, topLevelEntries } from './overlap'

describe('topLevelEntries', () => {
  it('reads the root name each payload path claims, once', () => {
    expect(topLevelEntries(['bin/daemon', 'bin/tool', 'etc/version'])).toEqual(['bin', 'etc'])
  })

  it('is not fooled by a leading slash', () => {
    expect(topLevelEntries(['/bin/daemon'])).toEqual(['bin'])
  })
})

describe('sharedEntryRefusal', () => {
  const DAEMON_PACKAGE = { packageName: 'bespok3d-daemon', payloadPaths: ['bin/bespok3d', 'etc/version'] }

  it('refuses the pair and names what they fight over', () => {
    const refusal = sharedEntryRefusal(DAEMON_PACKAGE, {
      packageName: 'snapmaker-u1-jinni',
      payloadPaths: ['bin/jinni', 'jinni/adapter.py'],
    })

    expect(refusal).toContain('bespok3d-daemon')
    expect(refusal).toContain('snapmaker-u1-jinni')
    expect(refusal).toContain('bin')
    expect(refusal).toContain('Neither was installed')
  })

  it('passes a pair that keeps to its own top-level entries', () => {
    expect(sharedEntryRefusal(DAEMON_PACKAGE, {
      packageName: 'snapmaker-u1-jinni',
      payloadPaths: ['jinni/adapter.py', 'jinni/steps.py'],
    })).toBeNull()
  })
})

describe('firstOverlapRefusal', () => {
  const DAEMON_PACKAGE = { packageName: 'bespok3d-daemon', payloadPaths: ['bin/bespok3d'] }
  const JINNI_PACKAGE = { packageName: 'snapmaker-u1-jinni', payloadPaths: ['jinni/adapter.py'] }

  // The clash is between the last two, so a check that only weighed each package against the first one
  // would let this set through.
  it('finds a clash between two packages that neither one has with the first', () => {
    const refusal = firstOverlapRefusal([DAEMON_PACKAGE, JINNI_PACKAGE,
      { packageName: 'spoolman', payloadPaths: ['jinni/adapter.py'] }])

    expect(refusal).toContain('snapmaker-u1-jinni')
    expect(refusal).toContain('spoolman')
  })

  it('passes a set in which every package keeps to its own entries', () => {
    expect(firstOverlapRefusal([DAEMON_PACKAGE, JINNI_PACKAGE,
      { packageName: 'spoolman', payloadPaths: ['spoolman/main.cfg'] }])).toBeNull()
  })

  it('passes a lone package, which can clash with nothing', () => {
    expect(firstOverlapRefusal([DAEMON_PACKAGE])).toBeNull()
  })
})
