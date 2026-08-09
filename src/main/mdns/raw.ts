// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import type { MdnsRecord, SrvData } from './types'
import { emitDiscovered } from './emit'
import { modelFromTxt, vendorFromTxt } from './identity'

var mdns4: MdnsInstance | null = null
var mdns6: MdnsInstance | null = null
export var retryTimer: ReturnType<typeof setInterval> | null = null

interface MdnsInstance {
  // multicast-dns is untyped; any[] lets our typed callbacks be assigned without contravariance errors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, cb: (...args: any[]) => void) => MdnsInstance
  query: (dnsQuery: { questions: unknown[] }) => void
  destroy: () => void
}

// multicast-dns ships no ESM export and no @types; require() is the only way in
// eslint-disable-next-line @typescript-eslint/no-require-imports
const createMdns = require('multicast-dns')

// Exported for the re-emit regression test (a moved printer must be reported at its new address).
export interface RawScanContext {
  win: BrowserWindow
  emitted: Set<string>
  ipByHost: Map<string, string>
  srvByInst: Map<string, SrvData>
  txtByInst: Map<string, Record<string, string>>
  serviceOfInst: Map<string, string>
  probed: Set<string>
}

const SERVICE_TYPE_PTR = '_services._dns-sd._udp.local'

function parseTxt(data: unknown): Record<string, string> {
  if (!Array.isArray(data)) return {}
  const out: Record<string, string> = {}
  data.forEach((chunk) => {
    const str = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk)
    const eqIndex = str.indexOf('=')
    if (eqIndex > 0) out[str.slice(0, eqIndex).toLowerCase()] = str.slice(eqIndex + 1)
  })

  return out
}

function send(questions: unknown[]): void {
  mdns4?.query({ questions })
  mdns6?.query({ questions })
}

function tryEmit(ctx: RawScanContext, instance: string): void {
  if (ctx.emitted.has(instance)) return
  const srvRecord = ctx.srvByInst.get(instance)
  if (!srvRecord) return
  const ip = ctx.ipByHost.get(srvRecord.target)
  if (!ip) return
  ctx.emitted.add(instance)
  const txt = ctx.txtByInst.get(instance) ?? {}
  emitDiscovered(ctx.win, {
    id: `mdns-${instance}`,
    host: srvRecord.target,
    ip,
    model: modelFromTxt(txt),
    vendor: vendorFromTxt(txt),
    service: ctx.serviceOfInst.get(instance) ?? instance.replace(/^[^.]+\./, ''),
  })
}

function retryInstance(ctx: RawScanContext, instance: string): void {
  if (ctx.emitted.has(instance)) return
  if (!ctx.srvByInst.has(instance)) {
    send([{ name: instance, type: 'SRV' }, { name: instance, type: 'TXT' }])

    return
  }
  const srvRecord = ctx.srvByInst.get(instance)!
  if (!ctx.ipByHost.has(srvRecord.target))
    send([{ name: srvRecord.target, type: 'A' }, { name: srvRecord.target, type: 'AAAA' }])
}

function retryPending(ctx: RawScanContext): void {
  ctx.serviceOfInst.forEach((_value, instance) => retryInstance(ctx, instance))
  ctx.probed.forEach((svcType) => send([{ name: svcType, type: 'PTR' }]))
  send([{ name: SERVICE_TYPE_PTR, type: 'PTR' }])
}

// Re-arm every instance on a host so the tryEmit pass at the end of handleResponse reports it again at
// its new address. Each instance is otherwise emitted ONCE per scan, so a printer whose IP changed
// would never be re-discovered and the app could never follow it to its new lease.
function clearEmittedForHost(ctx: RawScanContext, host: string): void {
  ctx.srvByInst.forEach((srvRecord, instance) => {
    if (srvRecord.target === host) ctx.emitted.delete(instance)
  })
}

function onARecord(ctx: RawScanContext, record: MdnsRecord): void {
  if (typeof record.data !== 'string') return
  const previousIp = ctx.ipByHost.get(record.name)
  ctx.ipByHost.set(record.name, record.data)
  // A printer that changed IP (a DHCP renewal) re-announces its A record with the new address; re-emit
  // so the moved printer is reported at where it now is, not just where discovery first saw it.
  if (previousIp !== undefined && previousIp !== record.data) clearEmittedForHost(ctx, record.name)
}

function onAaaaRecord(ctx: RawScanContext, record: MdnsRecord): void {
  if (typeof record.data === 'string' && !ctx.ipByHost.has(record.name))
    ctx.ipByHost.set(record.name, record.data)
}

function onServiceTypePtr(ctx: RawScanContext, record: MdnsRecord): void {
  if (typeof record.data !== 'string' || ctx.probed.has(record.data)) return
  ctx.probed.add(record.data)
  send([{ name: record.data, type: 'PTR' }])
}

function onInstancePtr(ctx: RawScanContext, record: MdnsRecord): void {
  if (typeof record.data !== 'string' || ctx.serviceOfInst.has(record.data)) return
  ctx.serviceOfInst.set(record.data, record.name)
  send([{ name: record.data, type: 'SRV' }, { name: record.data, type: 'TXT' }])
}

function onSrvRecord(ctx: RawScanContext, record: MdnsRecord): void {
  if (ctx.serviceOfInst.has(record.name)) ctx.srvByInst.set(record.name, record.data as SrvData)
}

function onTxtRecord(ctx: RawScanContext, record: MdnsRecord): void {
  if (ctx.serviceOfInst.has(record.name)) ctx.txtByInst.set(record.name, parseTxt(record.data))
}

function fetchMissingIps(ctx: RawScanContext): void {
  ctx.srvByInst.forEach((srvRecord) => {
    if (!ctx.ipByHost.has(srvRecord.target))
      send([{ name: srvRecord.target, type: 'A' }, { name: srvRecord.target, type: 'AAAA' }])
  })
}

export function handleResponse(
  ctx: RawScanContext,
  response: { answers: MdnsRecord[]; additionals: MdnsRecord[] }
): void {
  const allRecords = [...(response.answers ?? []), ...(response.additionals ?? [])]
  allRecords.forEach((record) => {
    if (record.type === 'PTR' && record.name === SERVICE_TYPE_PTR) onServiceTypePtr(ctx, record)
    if (record.type === 'PTR' && record.name !== SERVICE_TYPE_PTR) onInstancePtr(ctx, record)
    if (record.type === 'A') onARecord(ctx, record)
    if (record.type === 'AAAA') onAaaaRecord(ctx, record)
    if (record.type === 'SRV') onSrvRecord(ctx, record)
    if (record.type === 'TXT') onTxtRecord(ctx, record)
  })
  fetchMissingIps(ctx)
  ctx.serviceOfInst.forEach((_value, instance) => tryEmit(ctx, instance))
}

export function startRawScan(win: BrowserWindow, emitted: Set<string>): void {
  var ticks = 0
  const ctx: RawScanContext = {
    win,
    emitted,
    ipByHost: new Map(),
    srvByInst: new Map(),
    txtByInst: new Map(),
    serviceOfInst: new Map(),
    probed: new Set(),
  }

  mdns4 = createMdns()
  try {
    mdns6 = createMdns({ type: 'udp6', ip: 'ff02::fb' })
    mdns6?.on('error', () => {
      mdns6?.destroy()
      mdns6 = null
    })
  } catch {
    mdns6 = null
  }

  mdns4?.on('response', (response) => handleResponse(ctx, response))
  mdns6?.on('response', (response) => handleResponse(ctx, response))
  send([{ name: SERVICE_TYPE_PTR, type: 'PTR' }])

  retryTimer = setInterval(() => {
    retryPending(ctx)
    ticks++
    if (ticks >= 5) {
      clearInterval(retryTimer!)
      retryTimer = null
    }
  }, 3000)
}

export function stopRawScan(): void {
  if (retryTimer) {
    clearInterval(retryTimer)
    retryTimer = null
  }
  mdns4?.destroy()
  mdns4 = null
  mdns6?.destroy()
  mdns6 = null
}
