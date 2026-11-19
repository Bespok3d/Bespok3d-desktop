// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { repairBannerCondition, recoverBannerCondition, repairOrRecover, rootAccessBannerCondition, isWithinExpectedRestart, driftBannerCondition, driftedPluginCount, printerProblemBannerCondition, printerProblemCount, jinniBannerCondition, rebootBannerCondition } from './printer-banners'
import { jinniLags } from '../data/printers'
import type { JinniOffer } from '../data/printers'
import type { Printer } from '../data/types'

const BUNDLED_JINNI: JinniOffer = { version: '0.1.0', packageName: 'bespok3d-jinni-snapmaker-u1' }

const BASE: Printer = {
  id: 'p1', nick: 'Test', model: 'test', adapter: 'snapmaker-u1',
  host: 'test.local', ip: '1.2.3.4', status: 'online', installedIds: [], holdsDaemonAccess: false,
}

// Enrolled, daemon down, but reachable over SSH: the repairable case.
const ENROLLED: Printer = {
  ...BASE,
  enrollmentLog: { enrolledAt: '2026-05-25T00:00:00Z', adapterId: 'snapmaker-u1', steps: [] },
  connection: { reach: 'recoverable', sshOpen: true }, holdsDaemonAccess: true,
}

describe('repairBannerCondition', () => {
  it('is true for an enrolled printer whose daemon is down but reachable over SSH', () => {
    expect(repairBannerCondition(ENROLLED)).toBe(true)
  })

  it('is true regardless of installed plugins', () => {
    expect(repairBannerCondition({ ...ENROLLED, installedIds: ['camera-hw-accel'] })).toBe(true)
  })

  it('is false when the daemon is reachable (managed)', () => {
    expect(repairBannerCondition({ ...ENROLLED, status: 'managed', connection: { reach: 'managed', sshOpen: true }, holdsDaemonAccess: true })).toBe(false)
  })

  it('is false for an unenrolled printer even when online', () => {
    expect(repairBannerCondition(BASE)).toBe(false)
  })

  it('is false when the printer is alive but SSH is off (enable-root case, not repairable)', () => {
    expect(repairBannerCondition({ ...ENROLLED, connection: { reach: 'alive-no-ssh', sshOpen: false }, holdsDaemonAccess: true })).toBe(false)
  })

  it('is false when the printer is offline', () => {
    expect(repairBannerCondition({ ...ENROLLED, status: 'offline', connection: { reach: 'offline', sshOpen: false }, holdsDaemonAccess: true })).toBe(false)
  })

  it('is false while inside an expected-restart window', () => {
    const futureUntil = 10_000
    const currentInstant = 5_000
    expect(repairBannerCondition({ ...ENROLLED, expectedRestartUntil: futureUntil }, currentInstant)).toBe(false)
  })

  it('is true once the expected-restart window has expired', () => {
    const pastUntil = 4_000
    const currentInstant = 5_000
    expect(repairBannerCondition({ ...ENROLLED, expectedRestartUntil: pastUntil }, currentInstant)).toBe(true)
  })

  it('is false while still checking, even if a stale reach says recoverable (no green-dot + yellow-bar)', () => {
    const stillChecking = { ...ENROLLED, status: 'checking' as const }
    expect(repairBannerCondition(stillChecking)).toBe(false)
    expect(recoverBannerCondition({ ...stillChecking, writeLayerIntact: false })).toBe(false)
  })
})

describe('repairOrRecover (the post-OTA discriminator)', () => {
  const recoverable = { reach: 'recoverable' as const, holdsDaemonAccess: true, withinRestart: false }

  it('routes to recover when the write layer was reset (false)', () => {
    expect(repairOrRecover({ ...recoverable, writeLayerIntact: false })).toBe('recover')
  })

  it('routes to repair when the write layer is intact (true)', () => {
    expect(repairOrRecover({ ...recoverable, writeLayerIntact: true })).toBe('repair')
  })

  it('defaults to repair while not yet probed (undefined)', () => {
    expect(repairOrRecover({ ...recoverable, writeLayerIntact: undefined })).toBe('repair')
  })

  it('is null for a printer whose daemon this app holds no access to', () => {
    expect(repairOrRecover({ ...recoverable, holdsDaemonAccess: false, writeLayerIntact: false })).toBeNull()
  })

  it('is null when not recoverable', () => {
    expect(repairOrRecover({ ...recoverable, reach: 'managed', writeLayerIntact: false })).toBeNull()
    expect(repairOrRecover({ ...recoverable, reach: 'alive-no-ssh', writeLayerIntact: false })).toBeNull()
    expect(repairOrRecover({ ...recoverable, reach: undefined, writeLayerIntact: false })).toBeNull()
  })

  it('is null inside the expected-restart window', () => {
    expect(repairOrRecover({ ...recoverable, withinRestart: true, writeLayerIntact: false })).toBeNull()
  })
})

describe('recoverBannerCondition vs repairBannerCondition (mutually exclusive)', () => {
  it('shows recover (not repair) once the probe finds the write layer reset', () => {
    const reset = { ...ENROLLED, writeLayerIntact: false }
    expect(recoverBannerCondition(reset)).toBe(true)
    expect(repairBannerCondition(reset)).toBe(false)
  })

  it('shows repair (not recover) when the write layer is intact', () => {
    const intact = { ...ENROLLED, writeLayerIntact: true }
    expect(repairBannerCondition(intact)).toBe(true)
    expect(recoverBannerCondition(intact)).toBe(false)
  })

  it('shows repair (not recover) before the probe returns', () => {
    expect(repairBannerCondition(ENROLLED)).toBe(true)
    expect(recoverBannerCondition(ENROLLED)).toBe(false)
  })
})

describe('rootAccessBannerCondition', () => {
  it('is true for an enrolled printer that is alive but has SSH off', () => {
    expect(rootAccessBannerCondition({ ...ENROLLED, connection: { reach: 'alive-no-ssh', sshOpen: false }, holdsDaemonAccess: true })).toBe(true)
  })

  it('is false when the printer is reachable over SSH (repair case instead)', () => {
    expect(rootAccessBannerCondition(ENROLLED)).toBe(false)
  })

  it('is true for an unenrolled printer too: root access is needed to enroll it', () => {
    expect(rootAccessBannerCondition({ ...BASE, connection: { reach: 'alive-no-ssh', sshOpen: false }, holdsDaemonAccess: false })).toBe(true)
  })

  it('is suppressed inside the expected-restart window', () => {
    expect(rootAccessBannerCondition({ ...ENROLLED, connection: { reach: 'alive-no-ssh', sshOpen: false }, holdsDaemonAccess: true, expectedRestartUntil: 10_000 }, 5_000)).toBe(false)
  })

  it('is false while still checking, even when a stale reach says alive-no-ssh', () => {
    expect(rootAccessBannerCondition({ ...ENROLLED, status: 'checking', connection: { reach: 'alive-no-ssh', sshOpen: false }, holdsDaemonAccess: true })).toBe(false)
  })
})

describe('isWithinExpectedRestart', () => {
  it('is false when the printer has no expectedRestartUntil', () => {
    expect(isWithinExpectedRestart(ENROLLED, 1_000)).toBe(false)
  })

  it('is true while the timestamp is in the future', () => {
    expect(isWithinExpectedRestart({ ...ENROLLED, expectedRestartUntil: 2_000 }, 1_000)).toBe(true)
  })

  it('is false when the timestamp has already passed', () => {
    expect(isWithinExpectedRestart({ ...ENROLLED, expectedRestartUntil: 500 }, 1_000)).toBe(false)
  })
})

// The staging app on a printer the release app enrolled: it reached the daemon through an access grant,
// so it holds the credentials but never ran the enrollment and keeps no log of one.
const GRANTED: Printer = {
  ...BASE,
  connection: { reach: 'recoverable', sshOpen: true }, holdsDaemonAccess: true,
}

describe('a printer this app reached through an access grant, never enrolled from here', () => {
  it('is offered the repair once its daemon stops answering', () => {
    expect(repairBannerCondition(GRANTED)).toBe(true)
  })

  it('is offered the recover once the firmware update reset its write layer', () => {
    expect(recoverBannerCondition({ ...GRANTED, writeLayerIntact: false })).toBe(true)
  })
})

const MANAGED: Printer = {
  ...ENROLLED,
  status: 'managed',
  connection: { reach: 'managed', sshOpen: true }, holdsDaemonAccess: true,
}

const DRIFTED: Printer = {
  ...MANAGED,
  daemonDrift: [
    { pluginId: 'camera-hw-accel', symlinkIssueCount: 1 },
    { pluginId: 'rfid-ntag', symlinkIssueCount: 2 },
  ],
}

describe('driftedPluginCount', () => {
  it('is zero when daemonDrift is absent', () => {
    expect(driftedPluginCount(MANAGED)).toBe(0)
  })

  it('is zero when daemonDrift is an empty list', () => {
    expect(driftedPluginCount({ ...MANAGED, daemonDrift: [] })).toBe(0)
  })

  it('counts the number of affected plugins', () => {
    expect(driftedPluginCount(DRIFTED)).toBe(2)
  })
})

const UNWIRED_WITH_NO_PLUGINS_LEFT: Printer = {
  ...MANAGED,
  printerProblems: [
    { kind: 'includes_missing', detail: 'printer.cfg', pluginId: null },
    { kind: 'includes_missing', detail: 'moonraker.conf', pluginId: null },
  ],
}

describe('printerProblemCount', () => {
  it('is zero when the check reported no printer problem', () => {
    expect(printerProblemCount(MANAGED)).toBe(0)
  })

  it('counts what the printer needs and does not have', () => {
    expect(printerProblemCount(UNWIRED_WITH_NO_PLUGINS_LEFT)).toBe(2)
  })
})

describe('printerProblemBannerCondition', () => {
  it('is true for a printer that ignores bespok3d even with no plugins left to drift', () => {
    expect(driftedPluginCount(UNWIRED_WITH_NO_PLUGINS_LEFT)).toBe(0)
    expect(printerProblemBannerCondition(UNWIRED_WITH_NO_PLUGINS_LEFT)).toBe(true)
  })

  it('is false when nothing is wrong with the printer', () => {
    expect(printerProblemBannerCondition(MANAGED)).toBe(false)
  })

  it('is suppressed inside the expected-restart window', () => {
    const futureUntil = 10_000
    const currentInstant = 5_000
    expect(printerProblemBannerCondition({ ...UNWIRED_WITH_NO_PLUGINS_LEFT, expectedRestartUntil: futureUntil }, currentInstant)).toBe(false)
  })
})

describe('driftBannerCondition', () => {
  it('is true when a managed printer has drift outside the restart window', () => {
    expect(driftBannerCondition(DRIFTED)).toBe(true)
  })

  it('is false when status is online (repair banner takes priority)', () => {
    expect(driftBannerCondition({ ...DRIFTED, status: 'online' })).toBe(false)
  })

  it('is false when status is deactivated', () => {
    expect(driftBannerCondition({ ...DRIFTED, status: 'deactivated' })).toBe(false)
  })

  it('is false when there is no drift', () => {
    expect(driftBannerCondition(MANAGED)).toBe(false)
  })

  it('is suppressed inside the expected-restart window', () => {
    const futureUntil = 10_000
    const currentInstant = 5_000
    expect(driftBannerCondition({ ...DRIFTED, expectedRestartUntil: futureUntil }, currentInstant)).toBe(false)
  })
})

const NEEDS_REBOOT: Printer = {
  ...MANAGED,
  rebootRequired: ['some-future-token'],
}

describe('rebootBannerCondition', () => {
  it('is true for a managed printer the daemon says needs a power cycle', () => {
    expect(rebootBannerCondition(NEEDS_REBOOT)).toBe(true)
  })

  it('is false when rebootRequired is absent', () => {
    expect(rebootBannerCondition(MANAGED)).toBe(false)
  })

  it('is false when rebootRequired is an empty list', () => {
    expect(rebootBannerCondition({ ...MANAGED, rebootRequired: [] })).toBe(false)
  })

  it('is false when the printer is not managed', () => {
    expect(rebootBannerCondition({ ...NEEDS_REBOOT, status: 'online' })).toBe(false)
  })

  it('is suppressed inside the expected-restart window', () => {
    const futureUntil = 10_000
    const currentInstant = 5_000
    expect(rebootBannerCondition({ ...NEEDS_REBOOT, expectedRestartUntil: futureUntil }, currentInstant)).toBe(false)
  })

  it('is false for a printer whose screen only went to sleep', () => {
    // The U1 screen blanks itself when it is left alone, and printers on the older adapter still
    // report that ordinary blank as a dead screen. Showing it accused a healthy printer every time.
    expect(rebootBannerCondition({ ...MANAGED, rebootRequired: ['display-pipe-wedged'] })).toBe(false)
  })

  it('ranks above drift: a printer with both conditions still needs the reboot banner first', () => {
    const both = { ...NEEDS_REBOOT, daemonDrift: DRIFTED.daemonDrift }
    expect(rebootBannerCondition(both)).toBe(true)
    expect(driftBannerCondition(both)).toBe(true)
  })
})

describe('jinniLags', () => {
  it('lags when the deployed version differs from the bundled one', () => {
    expect(jinniLags({ jinniVersion: '0.0.9' }, BUNDLED_JINNI)).toBe(true)
  })

  it('does not lag when the versions match', () => {
    expect(jinniLags({ jinniVersion: '0.1.0' }, BUNDLED_JINNI)).toBe(false)
  })

  it('never lags when the device reports an unknown version (daemon too old to report)', () => {
    expect(jinniLags({ jinniVersion: 'unknown' }, BUNDLED_JINNI)).toBe(false)
    expect(jinniLags({ jinniVersion: undefined }, BUNDLED_JINNI)).toBe(false)
  })
})

describe('jinniBannerCondition', () => {
  it('is true for a managed printer whose jinni lags, outside the restart window', () => {
    expect(jinniBannerCondition({ ...MANAGED, jinniVersion: '0.0.9' }, BUNDLED_JINNI)).toBe(true)
  })

  it('is false when the jinni is current', () => {
    expect(jinniBannerCondition({ ...MANAGED, jinniVersion: '0.1.0' }, BUNDLED_JINNI)).toBe(false)
  })

  it('is false when the printer is not managed', () => {
    expect(jinniBannerCondition({ ...MANAGED, status: 'online', jinniVersion: '0.0.9' }, BUNDLED_JINNI)).toBe(false)
  })

  it('is suppressed inside the expected-restart window', () => {
    const futureUntil = 10_000
    const currentInstant = 5_000
    expect(jinniBannerCondition({ ...MANAGED, jinniVersion: '0.0.9', expectedRestartUntil: futureUntil }, BUNDLED_JINNI, currentInstant)).toBe(false)
  })
})
