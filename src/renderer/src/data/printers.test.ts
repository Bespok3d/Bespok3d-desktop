import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Printer } from './types'

type Reach = 'managed' | 'recoverable' | 'alive-no-ssh' | 'offline'
type CheckDaemonResult = { isManaged: boolean; reach?: Reach; sshOpen?: boolean; daemonVersion?: string; daemonUpdateAvailable?: boolean }

type CapsResult = { endpoints: Array<{ label: string; url: string }>; installed: Record<string, string> }

const mockPing = vi.fn<() => Promise<boolean>>()
const mockCheckDaemon = vi.fn<() => Promise<CheckDaemonResult>>()
const mockCheckWriteLayer = vi.fn<() => Promise<boolean | null>>()
const mockCapabilities = vi.fn<() => Promise<CapsResult>>()
const mockSave = vi.fn()
const mockPatch = vi.fn()
mockCheckWriteLayer.mockResolvedValue(null)

;(global as Record<string, unknown>).window = {
  b3d: {
    printers: { ping: mockPing, checkDaemon: mockCheckDaemon, checkWriteLayer: mockCheckWriteLayer, save: mockSave, patch: mockPatch },
    store: { capabilities: mockCapabilities },
  },
}

import { resolvedStatus, statusDotClass, pingAndUpdate, applyToId, patchAndSave, buildPrinter, statusAfterProbe, resetPrinterProbe, reconcileDiscoveredAddress, refreshEndpoints } from './printers'
import { repairBannerCondition } from '../components/printer-banners'
import type { DiscoveredPrinterRecord } from '../env'

const BASE: Printer = {
  id: 'p1', nick: 'Test', model: 'test', adapter: 'test',
  host: 'test.local', ip: '1.2.3.4', status: 'online', installedIds: [],
}

const ENROLLED: Printer = {
  ...BASE,
  enrollmentLog: { enrolledAt: '2026-05-25T00:00:00Z', adapterId: 'snapmaker-u1', steps: [] },
}

describe('resolvedStatus', () => {
  it('preserves managed status regardless of installedIds', () => {
    expect(resolvedStatus({ ...BASE, status: 'managed' })).toBe('managed')
  })

  it('returns managed when installedIds is non-empty', () => {
    expect(resolvedStatus({ ...BASE, installedIds: ['plugin-a'] })).toBe('managed')
  })

  it('returns online for an unenrolled printer with no installed plugins', () => {
    expect(resolvedStatus(BASE)).toBe('online')
  })

  it('returns managed when offline but has installed plugins', () => {
    expect(resolvedStatus({ ...BASE, status: 'offline', installedIds: ['plugin-a'] })).toBe('managed')
  })
})

describe('statusDotClass', () => {
  it('is the default (green) class for managed', () => {
    expect(statusDotClass({ ...BASE, status: 'managed' })).toBe('')
  })

  it('maps each coarse status to its dot colour class', () => {
    expect(statusDotClass({ ...BASE, status: 'online' })).toBe('online')
    expect(statusDotClass({ ...BASE, status: 'checking' })).toBe('checking')
    expect(statusDotClass({ ...BASE, status: 'offline' })).toBe('offline')
  })

  it('treats deactivated as the offline-coloured dot', () => {
    expect(statusDotClass({ ...BASE, status: 'deactivated' })).toBe('offline')
  })
})

function found(overrides: Partial<DiscoveredPrinterRecord> = {}): DiscoveredPrinterRecord {
  return { id: 'mdns-1', host: 'snap-a.local', ip: '192.168.9.30', model: 'U1', vendor: 'Snapmaker', service: '_moonraker._tcp', ...overrides }
}

describe('reconcileDiscoveredAddress', () => {
  const saved: Printer = { ...BASE, host: 'snap-a.local', ip: '192.168.9.45', status: 'managed', installedIds: ['p'] }

  it('adopts a new routable IPv4 when the same device (by hostname) moved DHCP lease', () => {
    const result = reconcileDiscoveredAddress(saved, found({ host: 'snap-a.local', ip: '192.168.9.30' }))
    expect(result.ip).toBe('192.168.9.30')
  })

  it('resolves two printers that swapped leases without crossing them (matched by hostname, not IP)', () => {
    const printerA: Printer = { ...BASE, id: 'a', host: 'snap-a.local', ip: '192.168.9.45' }
    const printerB: Printer = { ...BASE, id: 'b', host: 'snap-b.local', ip: '192.168.9.30' }
    const emitForA = found({ host: 'snap-a.local', ip: '192.168.9.30' })
    expect(reconcileDiscoveredAddress(printerA, emitForA).ip).toBe('192.168.9.30')
    // A's emit can only ever change an address on a hostname match, so B's address is never crossed.
    expect(reconcileDiscoveredAddress(printerB, emitForA).ip).toBe('192.168.9.30')
  })

  it('leaves the record (same reference) untouched when the device does not match', () => {
    const result = reconcileDiscoveredAddress(saved, found({ host: 'other.local', ip: '10.0.0.9' }))
    expect(result).toBe(saved)
  })

  it('keeps the saved IPv4 when discovery only reports an IPv6 link-local', () => {
    const result = reconcileDiscoveredAddress(saved, found({ host: 'snap-a.local', ip: 'fe80::1' }))
    expect(result.ip).toBe('192.168.9.45')
  })

  it('does not refresh a manual printer (host typed as a bare IP) from a hostname emit', () => {
    const manual: Printer = { ...BASE, host: '192.168.9.45', ip: '192.168.9.45' }
    const result = reconcileDiscoveredAddress(manual, found({ host: 'snap-a.local', ip: '192.168.9.30' }))
    expect(result).toBe(manual)
  })

  it('uses the MAC, not the shared hostname, so two `lava` printers are never crossed', () => {
    const junior: Printer = { ...BASE, host: 'lava', ip: '192.168.9.45', mac: '40:d9:5a:e4:cd:fc' }
    const otherU1Emit = found({ host: 'lava', ip: '192.168.9.30', mac: 'aa:bb:cc:dd:ee:ff' })
    // Same hostname, different MAC: the other U1's emit must not adopt junior's address.
    expect(reconcileDiscoveredAddress(junior, otherU1Emit)).toBe(junior)
  })

  it('follows the printer by MAC when its hostname-sharing twin is also on the LAN', () => {
    const junior: Printer = { ...BASE, host: 'lava', ip: '192.168.9.45', mac: '40:d9:5a:e4:cd:fc' }
    const juniorMovedEmit = found({ host: 'lava', ip: '192.168.9.30', mac: '40:d9:5a:e4:cd:fc' })
    expect(reconcileDiscoveredAddress(junior, juniorMovedEmit).ip).toBe('192.168.9.30')
  })
})

async function runUpdate(printer: Printer): Promise<Printer | undefined> {
  const calls: Array<(prev: Printer[]) => Printer[]> = []
  pingAndUpdate(printer, (updater) => calls.push(updater))
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  return calls.at(-1)?.([printer])?.[0]
}

describe('statusAfterProbe', () => {
  it('applies an upgrade (or equal) immediately and clears strikes', () => {
    expect(statusAfterProbe('offline', 'managed', 1)).toEqual({ status: 'managed', misses: 0 })
  })

  it('keeps the previous better status on a single downgrade (sticky)', () => {
    expect(statusAfterProbe('managed', 'online', 0)).toEqual({ status: 'managed', misses: 1 })
  })

  it('applies the downgrade once two consecutive probes agree', () => {
    expect(statusAfterProbe('managed', 'online', 1)).toEqual({ status: 'online', misses: 0 })
  })

  it('needs its own two strikes to fall from online to offline', () => {
    expect(statusAfterProbe('online', 'offline', 0)).toEqual({ status: 'online', misses: 1 })
    expect(statusAfterProbe('online', 'offline', 1)).toEqual({ status: 'offline', misses: 0 })
  })

  it('settles the first probe immediately from the checking start state (no stale-green hold)', () => {
    expect(statusAfterProbe('checking', 'offline', 0)).toEqual({ status: 'offline', misses: 0 })
    expect(statusAfterProbe('checking', 'online', 0)).toEqual({ status: 'online', misses: 0 })
    expect(statusAfterProbe('checking', 'managed', 0)).toEqual({ status: 'managed', misses: 0 })
  })
})

describe('pingAndUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPrinterProbe('p1')
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'offline', sshOpen: false })
    mockCheckWriteLayer.mockResolvedValue(null)
  })

  it('stays put on a single unreachable probe, then goes offline on the second (hysteresis)', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'offline', sshOpen: false })
    expect((await runUpdate(BASE))?.status).toBe('online')
    expect((await runUpdate(BASE))?.status).toBe('offline')
  })

  it('sets the printer to managed when the daemon answers', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: true, reach: 'managed', sshOpen: true })
    expect((await runUpdate(ENROLLED))?.status).toBe('managed')
  })

  it('records the connection reach on a managed answer', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: true, reach: 'managed', sshOpen: true })
    expect((await runUpdate(ENROLLED))?.connection).toEqual({ reach: 'managed', sshOpen: true })
  })

  it('sets the printer to online and records reach when the daemon is down but SSH is up', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true })
    const result = await runUpdate(ENROLLED)
    expect(result?.status).toBe('online')
    expect(result?.connection).toEqual({ reach: 'recoverable', sshOpen: true })
  })

  it('stores daemonVersion and daemonUpdateAvailable from the daemon answer', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: true, reach: 'managed', sshOpen: true, daemonVersion: '0.0.9', daemonUpdateAvailable: true })
    const result = await runUpdate(ENROLLED)
    expect(result?.daemonVersion).toBe('0.0.9')
    expect(result?.daemonUpdateAvailable).toBe(true)
  })

  it('keeps a non-enrolled reachable printer online', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true })
    expect((await runUpdate(BASE))?.status).toBe('online')
  })
})

// The "yellow banner must not jump the gun on a 1-2 ping network hiccup" contract, pinned end to end
// (pingAndUpdate -> repairBannerCondition). A single missed daemon probe holds BOTH status (managed)
// and reach (managed, via the line-144 guard), and the banner is gated on status==='online', so the
// repair banner cannot show. Only the SECOND consecutive miss downgrades status to online + reach to
// recoverable, at which point the repair banner is the correct, deliberate signal.
describe('connection hiccup does not jump the repair banner', () => {
  const MANAGED: Printer = { ...ENROLLED, status: 'managed', connection: { reach: 'managed', sshOpen: true } }

  beforeEach(() => {
    vi.clearAllMocks()
    resetPrinterProbe('p1')
    mockCheckWriteLayer.mockResolvedValue(null)
  })

  it('holds managed + shows no repair banner on the first missed probe', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true })
    const afterOne = await runUpdate(MANAGED)
    expect(afterOne?.status).toBe('managed')
    expect(afterOne?.connection).toEqual({ reach: 'managed', sshOpen: true })
    expect(repairBannerCondition(afterOne!)).toBe(false)
  })

  it('shows the repair banner only after the second consecutive miss', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true })
    const afterOne = await runUpdate(MANAGED)
    const afterTwo = await runUpdate(afterOne!)
    expect(afterTwo?.status).toBe('online')
    expect(afterTwo?.connection).toEqual({ reach: 'recoverable', sshOpen: true })
    expect(repairBannerCondition(afterTwo!)).toBe(true)
  })

  it('clears the strike (no banner) when the daemon answers again before the second miss', async () => {
    mockCheckDaemon.mockResolvedValueOnce({ isManaged: false, reach: 'recoverable', sshOpen: true })
    const afterMiss = await runUpdate(MANAGED)
    expect(repairBannerCondition(afterMiss!)).toBe(false)
    mockCheckDaemon.mockResolvedValue({ isManaged: true, reach: 'managed', sshOpen: true })
    const recovered = await runUpdate(afterMiss!)
    expect(recovered?.status).toBe('managed')
    expect(repairBannerCondition(recovered!)).toBe(false)
  })
})

// Fold every updater the ping pushed (the connection set plus any later write-layer set) so the
// probe's async write is visible. Six microtask ticks cover the extra checkWriteLayer hop.
async function foldUpdaters(printer: Printer): Promise<Printer | undefined> {
  const calls: Array<(prev: Printer[]) => Printer[]> = []
  pingAndUpdate(printer, (updater) => calls.push(updater))
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()

  return calls.reduce((acc, updater) => updater(acc), [printer])[0]
}

describe('pingAndUpdate write-layer probe (repair vs recover)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPrinterProbe('p1')
    mockCheckWriteLayer.mockResolvedValue(null)
  })

  it('probes once for a recoverable enrolled printer and caches the verdict', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true })
    mockCheckWriteLayer.mockResolvedValue(false)
    const result = await foldUpdaters(ENROLLED)
    expect(mockCheckWriteLayer).toHaveBeenCalledWith('p1')
    expect(result?.writeLayerIntact).toBe(false)
  })

  it('does not probe a custom-credential printer (defers to the op-time backstop)', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true })
    await foldUpdaters({ ...ENROLLED, customSshCredentials: true })
    expect(mockCheckWriteLayer).not.toHaveBeenCalled()
  })

  it('does not re-probe once a verdict is cached', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true })
    await foldUpdaters({ ...ENROLLED, writeLayerIntact: true })
    expect(mockCheckWriteLayer).not.toHaveBeenCalled()
  })

  it('does not probe an unenrolled printer', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true })
    await foldUpdaters(BASE)
    expect(mockCheckWriteLayer).not.toHaveBeenCalled()
  })

  it('does not probe when the printer is not recoverable', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: false, reach: 'alive-no-ssh', sshOpen: false })
    await foldUpdaters(ENROLLED)
    expect(mockCheckWriteLayer).not.toHaveBeenCalled()
  })

  it('clears a cached verdict when the daemon answers again (a future OTA re-probes)', async () => {
    mockCheckDaemon.mockResolvedValue({ isManaged: true, reach: 'managed', sshOpen: true })
    const result = await foldUpdaters({ ...ENROLLED, writeLayerIntact: false })
    expect(result?.writeLayerIntact).toBeUndefined()
  })
})

const DISCOVERED: DiscoveredPrinterRecord = {
  id: 'd1', host: 'snap.local', ip: '10.0.0.5', model: 'Snapmaker U1', vendor: 'Snapmaker', service: '_klipper._tcp',
}

describe('buildPrinter', () => {
  it('records the custom-credentials choice on a scanned printer', () => {
    expect(buildPrinter('scan', DISCOVERED, '', 'Studio', 'snapmaker-u1', true).customSshCredentials).toBe(true)
  })

  it('records the custom-credentials choice on a manual printer', () => {
    expect(buildPrinter('manual', null, '10.0.0.9', 'Garage', 'snapmaker-u1', false).customSshCredentials).toBe(false)
  })
})

describe('refreshEndpoints', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pulls fresh endpoints and versions into the matching printer (the fly-out stays live after a batch)', async () => {
    mockCapabilities.mockResolvedValue({ endpoints: [{ label: 'Mainsail', url: 'http://1.2.3.4' }], installed: { cam: '1.0.0' } })
    const calls: Array<(prev: Printer[]) => Printer[]> = []
    await refreshEndpoints('p1', (updater) => calls.push(updater))
    const result = calls.at(-1)?.([{ ...BASE, id: 'p1' }])?.[0]
    expect(result?.endpoints).toEqual([{ label: 'Mainsail', url: 'http://1.2.3.4' }])
    expect(result?.installedVersions).toEqual({ cam: '1.0.0' })
  })

  it('swallows a fetch failure and applies no patch (main already saved fresh endpoints)', async () => {
    mockCapabilities.mockRejectedValue(new Error('unreachable'))
    const calls: Array<unknown> = []
    await refreshEndpoints('p1', (updater) => calls.push(updater))
    expect(calls).toHaveLength(0)
  })
})

describe('applyToId', () => {
  it('patches the matching printer and leaves others unchanged', () => {
    const printers: Printer[] = [
      { ...BASE, id: 'a', nick: 'Alpha' },
      { ...BASE, id: 'b', nick: 'Beta' },
    ]
    const result = applyToId('a', { nick: 'Updated' })(printers)
    expect(result[0].nick).toBe('Updated')
    expect(result[1].nick).toBe('Beta')
  })

  it('merges the patch: does not replace the whole printer', () => {
    const printers: Printer[] = [{ ...BASE, id: 'a', nick: 'Alpha' }]
    const result = applyToId('a', { status: 'managed' })(printers)
    expect(result[0].nick).toBe('Alpha')
    expect(result[0].status).toBe('managed')
  })

  it('returns the array unchanged when id does not match any printer', () => {
    const printers: Printer[] = [{ ...BASE, id: 'a' }]
    const result = applyToId('nonexistent', { status: 'offline' })(printers)
    expect(result[0]).toBe(printers[0])
  })
})

describe('patchAndSave', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches the matching printer in the list and persists only the changed fields', () => {
    const printers: Printer[] = [{ ...BASE, id: 'a', nick: 'Alpha' }, { ...BASE, id: 'b', nick: 'Beta' }]
    var current = printers
    function set(updater: (prev: Printer[]) => Printer[]) { current = updater(current) }
    patchAndSave(set, 'a', { iconColor: '#fff' })
    expect(current[0].iconColor).toBe('#fff')
    expect(current[1]).toBe(printers[1])
    expect(mockPatch).toHaveBeenCalledWith('a', { iconColor: '#fff' })
  })

  it('persists nothing when no printer matches the id', () => {
    const printers: Printer[] = [{ ...BASE, id: 'a' }]
    function set(updater: (prev: Printer[]) => Printer[]) { updater(printers) }
    patchAndSave(set, 'missing', { nick: 'x' })
    expect(mockPatch).not.toHaveBeenCalled()
  })
})
