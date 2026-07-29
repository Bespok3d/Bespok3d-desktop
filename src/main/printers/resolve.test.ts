// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./probe', () => ({ checkDaemon: vi.fn(), checkSshOpen: vi.fn() }))
vi.mock('./store', () => ({ loadPrinters: vi.fn(), updatePrinter: vi.fn() }))
vi.mock('../mdns/sightings', () => ({ liveSightings: vi.fn().mockReturnValue([]) }))

import { resolveLiveAddress, knownAddresses } from './resolve'
import { checkDaemon, checkSshOpen } from './probe'
import { loadPrinters, updatePrinter } from './store'
import { liveSightings } from '../mdns/sightings'

const RECORD = { id: 'p1', host: 'lava', ip: '192.0.2.109', mac: '00:00:5e:00:53:fc' }

function answersAt(...liveIps: string[]): void {
  vi.mocked(checkDaemon).mockImplementation(async (ip: string) => liveIps.includes(ip))
  vi.mocked(checkSshOpen).mockResolvedValue(false)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadPrinters).mockReturnValue([RECORD as never])
  vi.mocked(liveSightings).mockReturnValue([])
})

describe('resolveLiveAddress', () => {
  it('keeps the recorded IP without probing when there is no other candidate', async () => {
    expect(await resolveLiveAddress('p1')).toBe('192.0.2.109')
    expect(checkDaemon).not.toHaveBeenCalled()
  })

  it('follows a flip-flopping printer to the lease that answers, and persists it', async () => {
    vi.mocked(liveSightings).mockReturnValue([{ host: 'lava', ip: '192.0.2.66', mac: '00:00:5e:00:53:fc', seenAt: Date.now() }])
    answersAt('192.0.2.66') // recorded .109 is dead, the moved .66 answers
    expect(await resolveLiveAddress('p1')).toBe('192.0.2.66')
    expect(updatePrinter).toHaveBeenCalledWith('p1', { ip: '192.0.2.66' })
  })

  it('prefers the recorded IP when it still answers, even with another candidate present', async () => {
    vi.mocked(liveSightings).mockReturnValue([{ host: 'lava', ip: '192.0.2.66', mac: '00:00:5e:00:53:fc', seenAt: Date.now() }])
    answersAt('192.0.2.109', '192.0.2.66') // both answer (it flipped back); keep the recorded one, no thrash
    expect(await resolveLiveAddress('p1')).toBe('192.0.2.109')
    expect(updatePrinter).not.toHaveBeenCalled()
  })

  it('returns the recorded IP when nothing answers, so the caller still has an address to try', async () => {
    vi.mocked(liveSightings).mockReturnValue([{ host: 'lava', ip: '192.0.2.66', mac: '00:00:5e:00:53:fc', seenAt: Date.now() }])
    answersAt() // neither answers
    expect(await resolveLiveAddress('p1')).toBe('192.0.2.109')
    expect(updatePrinter).not.toHaveBeenCalled()
  })
})

describe('knownAddresses (the dropdown "Also reachable at" line)', () => {
  it('lists the recorded IP plus a fresh alternate lease, for a flip-flopping printer', () => {
    vi.mocked(liveSightings).mockReturnValue([{ host: 'lava', ip: '192.0.2.66', mac: '00:00:5e:00:53:fc', seenAt: Date.now() }])
    expect(knownAddresses('p1')).toEqual([{ ip: '192.0.2.109' }, { ip: '192.0.2.66' }])
  })

  it('lists just the recorded IP for a stable printer (so the line stays hidden)', () => {
    vi.mocked(liveSightings).mockReturnValue([])
    expect(knownAddresses('p1')).toEqual([{ ip: '192.0.2.109' }])
  })
})
