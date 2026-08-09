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

// The record a real Snapmaker U1 answers with, serial and account replaced. This scanner is the one
// that runs on Windows and Linux (the dns-sd one is macOS only), so a key it cannot read is a printer
// that never gets its adapter picked for it off a Mac.
function u1TxtRecord(): { answers: MdnsRecord[]; additionals: MdnsRecord[] } {
  const txt = ['version=1.5.2', 'machine_type=Snapmaker U1', 'device_name=unU1', 'region=int']

  return {
    answers: [{ type: 'TXT', name: INSTANCE, data: txt.map((pair) => Buffer.from(pair)), ttl: 120 }],
    additionals: [{ type: 'A', name: HOST, data: '192.0.2.108', ttl: 120 }],
  }
}

describe('a Windows or Linux scan names the printer it found', () => {
  beforeEach(() => vi.mocked(emitDiscovered).mockClear())

  // The adapter is chosen from this model string by guessAdapter, covered in printerDiscovery.test.ts.
  it('reports the Snapmaker U1 by name, not as an anonymous network device', () => {
    handleResponse(makeContext(), u1TxtRecord())
    const found = vi.mocked(emitDiscovered).mock.calls[0][1] as { model: string }
    expect(found.model).toBe('Snapmaker U1')
  })
})

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
