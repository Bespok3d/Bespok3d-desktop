// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  fetchDaemonStatus: vi.fn(), fetchCapabilities: vi.fn(), fetchSelfCheck: vi.fn(),
  EXPECTED_DAEMON_VERSION: '0.12.12-dev',
}))
vi.mock('../printers', () => ({
  loadPrinters: vi.fn().mockReturnValue([]), updatePrinter: vi.fn(), checkDaemon: vi.fn(),
  checkMoonraker: vi.fn(), checkSshOpen: vi.fn(), resolveLiveAddress: vi.fn().mockResolvedValue('10.0.0.5'),
  knownAddresses: vi.fn().mockReturnValue([]),
  gradeReach: (moonrakerOpen: boolean, sshOpen: boolean) => {
    if (sshOpen) return 'recoverable'

    return moonrakerOpen ? 'alive-no-ssh' : 'offline'
  },
}))
vi.mock('../mdns/arp', () => ({ macForIp: vi.fn().mockReturnValue(undefined) }))

import {
  summarizeDrift, dedupeEndpoints, parseCaps, daemonNeedsUpdate, assertDaemonVersion,
  verifyDaemonVersion, getManagedRecord, recordOrThrow, checkDaemonRecord, switchedOffCorrection,
} from './status'
import { fetchDaemonStatus, fetchCapabilities, fetchSelfCheck } from './client'
import { loadPrinters, updatePrinter, checkDaemon, checkMoonraker, checkSshOpen, resolveLiveAddress } from '../printers'
import type { SelfCheckResult } from './client'

beforeEach(() => vi.clearAllMocks())

describe('summarizeDrift', () => {
  it('returns an empty list when the daemon reports ok=true', () => {
    expect(summarizeDrift({ ok: true, drift: [] })).toEqual([])
  })

  it('returns one entry per affected plugin with its symlink issue count', () => {
    const driftPresent: SelfCheckResult = {
      ok: false,
      drift: [
        { plugin_id: 'camera-hw-accel', symlink_issues: [{ kind: 'missing', link_path: '/some/path' }, { kind: 'wrong_target', link_path: '/other/path', expected_target: '/x', actual_target: '/y' }] },
        { plugin_id: 'rfid-ntag', symlink_issues: [{ kind: 'not_a_symlink', link_path: '/another' }] },
      ],
    }
    expect(summarizeDrift(driftPresent)).toEqual([
      { pluginId: 'camera-hw-accel', symlinkIssueCount: 2 },
      { pluginId: 'rfid-ntag', symlinkIssueCount: 1 },
    ])
  })
})

describe('dedupeEndpoints', () => {
  it('drops endpoints that repeat the same url, keeping first position', () => {
    const withDuplicate = [
      { label: 'Fluidd', url: 'https://printer.local/' },
      { label: 'Moonraker API', url: 'https://printer.local:7125/' },
      { label: 'Fluidd', url: 'https://printer.local/' },
    ]
    expect(dedupeEndpoints(withDuplicate)).toEqual([
      { label: 'Fluidd', url: 'https://printer.local/' },
      { label: 'Moonraker API', url: 'https://printer.local:7125/' },
    ])
  })

  it('keeps distinct urls that happen to share a label', () => {
    const sameLabel = [
      { label: 'Camera', url: 'https://printer.local/webcam/' },
      { label: 'Camera', url: 'https://printer.local/webcam2/' },
    ]
    expect(dedupeEndpoints(sameLabel)).toEqual(sameLabel)
  })
})

describe('parseCaps', () => {
  it('substitutes the host into endpoint urls and reads installed versions', () => {
    const caps = {
      installed: { spoolman: '0.1.8' },
      endpoints: [{ label: 'Fluidd', url: 'https://{host}/' }],
      firmware_version: '1.4.0.246', jinni_version: '0.1.1', capability_flags: ['overlay'], interface_extras: ['lmd-control'],
    } as never
    const parsed = parseCaps(caps, '10.0.0.5')
    expect(parsed.installedIds).toEqual(['spoolman'])
    expect(parsed.installedVersions).toEqual({ spoolman: '0.1.8' })
    expect(parsed.endpoints).toEqual([{ label: 'Fluidd', url: 'https://10.0.0.5/' }])
    expect(parsed.firmwareVersion).toBe('1.4.0.246')
    expect(parsed.jinniVersion).toBe('0.1.1')
  })

  it('tolerates a legacy installed list (no versions) by mapping ids to empty strings', () => {
    const parsed = parseCaps({ installed: ['spoolman', 'rfid-ntag'] } as never, '10.0.0.5')
    expect(parsed.installedIds).toEqual(['spoolman', 'rfid-ntag'])
    expect(parsed.installedVersions).toEqual({ spoolman: '', 'rfid-ntag': '' })
  })
})

describe('daemonNeedsUpdate', () => {
  it('signals an update when the printer reports an older daemon than the app bundles', () => {
    expect(daemonNeedsUpdate('0.10.31-dev')).toBe(true)
  })

  it('signals an update when the printer never reported a version', () => {
    expect(daemonNeedsUpdate(undefined)).toBe(true)
  })

  it('does not signal when the printer already runs the bundled version', () => {
    expect(daemonNeedsUpdate('0.12.12-dev')).toBe(false)
  })

  it('never proposes a downgrade when the printer runs a newer daemon than the app bundles', () => {
    expect(daemonNeedsUpdate('0.13.0-dev')).toBe(false)
  })
})

describe('assertDaemonVersion', () => {
  it('throws when the printer did not come back on the bundled version after an update', () => {
    expect(() => assertDaemonVersion('0.10.31-dev')).toThrow(/expected 0\.12\.12-dev/)
  })

  it('throws when the daemon reports no version', () => {
    expect(() => assertDaemonVersion(undefined)).toThrow()
  })

  it('passes only when the printer reports exactly the bundled version', () => {
    expect(() => assertDaemonVersion('0.12.12-dev')).not.toThrow()
  })
})

describe('verifyDaemonVersion', () => {
  const anyRecord = {} as Parameters<typeof verifyDaemonVersion>[0]

  it('resolves when the printer reports the bundled version', async () => {
    vi.mocked(fetchDaemonStatus).mockResolvedValueOnce({ ok: true, version: '0.12.12-dev' })
    await expect(verifyDaemonVersion(anyRecord, 1)).resolves.toBeUndefined()
  })

  it('fails cleanly (does not hang) when the printer stays on an older version', async () => {
    vi.mocked(fetchDaemonStatus).mockResolvedValue({ ok: true, version: '0.10.31-dev' })
    await expect(verifyDaemonVersion(anyRecord, 1)).rejects.toThrow(/expected 0\.12\.12-dev/)
  })

  it('fails cleanly (does not hang) when /status never answers', async () => {
    vi.mocked(fetchDaemonStatus).mockRejectedValue(new Error('daemon request timed out'))
    await expect(verifyDaemonVersion(anyRecord, 1)).rejects.toThrow()
  })
})

describe('getManagedRecord', () => {
  it('throws when the record has no daemon token or cert', () => {
    vi.mocked(loadPrinters).mockReturnValue([{ id: 'p1' } as never])
    expect(() => getManagedRecord('p1')).toThrow('printer not managed')
  })

  it('returns the record when it is managed', () => {
    const managed = { id: 'p1', daemonToken: 'T', daemonCert: 'C' }
    vi.mocked(loadPrinters).mockReturnValue([managed as never])
    expect(getManagedRecord('p1')).toBe(managed)
  })
})

describe('recordOrThrow', () => {
  it('throws when no record matches the id', () => {
    vi.mocked(loadPrinters).mockReturnValue([])
    expect(() => recordOrThrow('missing')).toThrow('printer not found')
  })

  it('returns the record regardless of whether it is managed', () => {
    const unmanaged = { id: 'p1' }
    vi.mocked(loadPrinters).mockReturnValue([unmanaged as never])
    expect(recordOrThrow('p1')).toBe(unmanaged)
  })
})

function mockManagedRecord(): void {
  vi.mocked(loadPrinters).mockReturnValue([{ id: 'p1', ip: '10.0.0.5', daemonToken: 'T', daemonCert: 'C' } as never])
}
function mockDaemonAnswers(version: string): void {
  vi.mocked(checkDaemon).mockResolvedValue(true)
  vi.mocked(fetchDaemonStatus).mockResolvedValue({ ok: true, version })
  vi.mocked(fetchCapabilities).mockResolvedValue({ installed: {}, endpoints: [] } as never)
  vi.mocked(fetchSelfCheck).mockResolvedValue({ ok: true, drift: [] })
}

describe('checkDaemonRecord (connection ladder)', () => {
  it('reports offline when the printer record is unknown', async () => {
    vi.mocked(loadPrinters).mockReturnValue([])
    expect(await checkDaemonRecord('missing')).toEqual({ isManaged: false, reach: 'offline', sshOpen: false, ip: '', networkInterfaces: [] })
  })

  it('grades the moonraker/ssh ladder when the daemon does not answer', async () => {
    mockManagedRecord()
    vi.mocked(checkDaemon).mockResolvedValue(false)
    vi.mocked(checkMoonraker).mockResolvedValue(true)
    vi.mocked(checkSshOpen).mockResolvedValue(true)
    expect(await checkDaemonRecord('p1')).toEqual({ isManaged: false, reach: 'recoverable', sshOpen: true, ip: '10.0.0.5', networkInterfaces: [] })
  })

  it('reports managed with metadata when the daemon answers', async () => {
    mockManagedRecord()
    mockDaemonAnswers('0.12.12-dev')
    const result = await checkDaemonRecord('p1')
    expect(result.isManaged).toBe(true)
    expect(result.reach).toBe('managed')
    expect(result.daemonVersion).toBe('0.12.12-dev')
    expect(result.daemonUpdateAvailable).toBe(false)
  })
})

describe('checkDaemonRecord learns the daemon-minted printer uuid', () => {
  const MINTED_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('captures printer_uuid from /status onto the record and the probe result', async () => {
    mockManagedRecord()
    mockDaemonAnswers('0.12.12-dev')
    vi.mocked(fetchDaemonStatus).mockResolvedValue({ ok: true, version: '0.12.12-dev', printer_uuid: MINTED_UUID })

    const result = await checkDaemonRecord('p1')

    expect(result.printerUuid).toBe(MINTED_UUID)
    expect(vi.mocked(updatePrinter)).toHaveBeenCalledWith('p1', expect.objectContaining({ printerUuid: MINTED_UUID }))
  })

  it('never patches (so never clears) the recorded uuid when an old daemon omits the key or reports null', async () => {
    mockManagedRecord()
    mockDaemonAnswers('0.12.12-dev')
    vi.mocked(fetchDaemonStatus).mockResolvedValue({ ok: true, version: '0.12.12-dev', printer_uuid: null })

    const result = await checkDaemonRecord('p1')

    expect(result.printerUuid).toBeUndefined()
    const patch = vi.mocked(updatePrinter).mock.calls[0][1]
    expect(patch).not.toHaveProperty('printerUuid')
  })
})

describe('checkDaemonRecord follows a moved or recycled IP (Bug B)', () => {
  it('grades offline (not alive-no-ssh) when only a foreign device answers at the recorded IP', async () => {
    mockManagedRecord()
    vi.mocked(checkDaemon).mockResolvedValue(false)
    vi.mocked(checkMoonraker).mockResolvedValue(false)
    vi.mocked(checkSshOpen).mockResolvedValue(false)
    expect(await checkDaemonRecord('p1')).toEqual({ isManaged: false, reach: 'offline', sshOpen: false, ip: '10.0.0.5', networkInterfaces: [] })
  })

  it('follows the printer to the live IP (resolved among candidates) and re-probes + returns it', async () => {
    mockManagedRecord()
    // Daemon down at the recorded .5; resolveLiveAddress finds it answering at the moved .9.
    vi.mocked(resolveLiveAddress).mockResolvedValue('10.0.0.9')
    vi.mocked(checkDaemon).mockImplementation(async (ip: string) => ip === '10.0.0.9')
    vi.mocked(fetchDaemonStatus).mockResolvedValue({ ok: true, version: '0.12.12-dev' })
    vi.mocked(fetchCapabilities).mockResolvedValue({ installed: {}, endpoints: [] } as never)
    vi.mocked(fetchSelfCheck).mockResolvedValue({ ok: true, drift: [] })
    const result = await checkDaemonRecord('p1')
    expect(result.isManaged).toBe(true)
    expect(result.reach).toBe('managed')
    expect(result.ip).toBe('10.0.0.9')
  })
})

describe('switchedOffCorrection (the printer decides, not the app records)', () => {
  const managed = { id: 'p1', status: 'managed' } as never
  const offRecord = { id: 'p1', status: 'deactivated', deactivated: true, deactivatedAt: '2026-01-01T00:00:00.000Z' } as never

  it('marks a printer deactivated when the printer says it is switched off', () => {
    const patch = switchedOffCorrection(managed, { ok: true, switched_off: true })
    expect(patch.status).toBe('deactivated')
    expect(patch.deactivated).toBe(true)
    expect(typeof patch.deactivatedAt).toBe('string')
  })

  it('switches the record back on when the printer no longer reports it off', () => {
    expect(switchedOffCorrection(offRecord, { ok: true, switched_off: false }))
      .toEqual({ deactivated: false, status: 'managed', deactivatedAt: undefined })
  })

  it('changes nothing when the record already agrees with the printer', () => {
    expect(switchedOffCorrection(managed, { ok: true, switched_off: false })).toEqual({})
    expect(switchedOffCorrection(offRecord, { ok: true, switched_off: true })).toEqual({})
  })

  it('reads a daemon too old to answer the question as switched on', () => {
    expect(switchedOffCorrection(managed, { ok: true })).toEqual({})
  })
})

describe('checkDaemonRecord carries the switched-off fact off the printer', () => {
  it('reports switchedOff and writes the deactivated status onto the record', async () => {
    mockManagedRecord()
    mockDaemonAnswers('0.12.12-dev')
    vi.mocked(fetchSelfCheck).mockResolvedValue({ ok: true, switched_off: true, drift: [] })

    const result = await checkDaemonRecord('p1')

    expect(result.switchedOff).toBe(true)
    expect(vi.mocked(updatePrinter)).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'deactivated' }))
  })

  it('reports a printer that is on as not switched off', async () => {
    mockManagedRecord()
    mockDaemonAnswers('0.12.12-dev')

    const result = await checkDaemonRecord('p1')

    expect(result.switchedOff).toBe(false)
  })
})

describe('checkDaemonRecord carries reboot_required off the printer', () => {
  it('reports the tokens the printer says need a power cycle', async () => {
    mockManagedRecord()
    mockDaemonAnswers('0.12.12-dev')
    vi.mocked(fetchSelfCheck).mockResolvedValue({ ok: true, drift: [], reboot_required: ['display-pipe-wedged'] })

    const result = await checkDaemonRecord('p1')

    expect(result.rebootRequired).toEqual(['display-pipe-wedged'])
    expect(vi.mocked(updatePrinter)).toHaveBeenCalledWith('p1', expect.objectContaining({ rebootRequired: ['display-pipe-wedged'] }))
  })

  it('reads an absent key (a daemon too old to report it) as no reboot needed, never unknown', async () => {
    mockManagedRecord()
    mockDaemonAnswers('0.12.12-dev')

    const result = await checkDaemonRecord('p1')

    expect(result.rebootRequired).toEqual([])
  })
})
