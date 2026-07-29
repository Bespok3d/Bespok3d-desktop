// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./emit', () => ({ emitDiscovered: vi.fn() }))

import { handleResponse, type RawScanContext } from './raw'
import { emitDiscovered } from './emit'
import type { MdnsRecord } from './types'

const INSTANCE = 'U1-SERIAL._moonraker._tcp.local'
const HOST = 'U1-SERIAL.local'

function makeContext(): RawScanContext {
  return {
    win: { isDestroyed: () => false } as never,
    emitted: new Set(),
    ipByHost: new Map(),
    srvByInst: new Map([[INSTANCE, { target: HOST, port: 7125, weight: 0, priority: 0 }]]),
    txtByInst: new Map(),
    serviceOfInst: new Map([[INSTANCE, '_moonraker._tcp']]),
    probed: new Set(),
  }
}

function aRecord(ip: string): { answers: MdnsRecord[]; additionals: MdnsRecord[] } {
  return { answers: [{ type: 'A', name: HOST, data: ip, ttl: 120 }], additionals: [] }
}

function emittedIps(): string[] {
  return vi.mocked(emitDiscovered).mock.calls.map((call) => (call[1] as { ip: string }).ip)
}

describe('raw mDNS scanner re-emits a printer that changed IP', () => {
  beforeEach(() => vi.mocked(emitDiscovered).mockClear())

  it('reports the moved printer at its new address, not just where it was first seen', () => {
    const ctx = makeContext()
    handleResponse(ctx, aRecord('192.0.2.109')) // first announcement
    handleResponse(ctx, aRecord('192.0.2.66')) // DHCP renewal: same host, new IP
    expect(emittedIps()).toEqual(['192.0.2.109', '192.0.2.66'])
  })

  it('does not re-emit when the same address is re-announced (no spurious churn)', () => {
    const ctx = makeContext()
    handleResponse(ctx, aRecord('192.0.2.66'))
    handleResponse(ctx, aRecord('192.0.2.66'))
    expect(emittedIps()).toEqual(['192.0.2.66'])
  })
})
