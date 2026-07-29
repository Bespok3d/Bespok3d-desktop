// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawn } from 'child_process'
import { platform } from 'os'
import { lookup } from 'dns'
import type { BrowserWindow } from 'electron'
import { emitDiscovered } from './emit'

interface DnsSdContext {
  win: BrowserWindow
  emitted: Set<string>
  runningProcesses: ReturnType<typeof spawn>[]
  browsedTypes: Set<string>
  resolvedInstances: Set<string>
  metaLineBuffer: string
}

interface ResolveState {
  lineBuffer: string
  foundHost: string
}

function killAll(ctx: DnsSdContext): void {
  ctx.runningProcesses.forEach((subprocess) => {
    try {
      subprocess.kill()
    } catch {
      // process may already be dead
    }
  })
}

function onResolveData(
  state: ResolveState,
  emit: (ip: string, model: string) => void,
  data: Buffer
): void {
  state.lineBuffer += data.toString()
  const lines = state.lineBuffer.split('\n')
  state.lineBuffer = lines.pop() ?? ''
  lines.forEach((line) => {
    const srvMatch = line.match(/can be reached at ([^:]+):\d+/)
    if (srvMatch) {
      state.foundHost = srvMatch[1].replace(/\.$/, '')

      return
    }
    if (/^\s+\w+=/.test(line) && state.foundHost) {
      const ipMatch = line.match(/\bip=(\d+\.\d+\.\d+\.\d+)/)
      const modelMatch = line.match(/machine_type=((?:\\ |[^ ])+)/)
      const model = modelMatch?.[1].replace(/\\ /g, ' ') ?? ''
      if (ipMatch) emit(ipMatch[1], model)
    }
  })
}

function resolveInstance(ctx: DnsSdContext, instanceName: string, svcType: string): void {
  const key = `${instanceName}\0${svcType}`
  if (ctx.resolvedInstances.has(key)) return
  ctx.resolvedInstances.add(key)

  const state: ResolveState = { lineBuffer: '', foundHost: '' }
  const lookupProcess = spawn('dns-sd', ['-L', instanceName, svcType, 'local'])
  ctx.runningProcesses.push(lookupProcess)

  function emit(ip: string, model: string) {
    if (ctx.emitted.has(key)) return
    ctx.emitted.add(key)
    emitDiscovered(ctx.win, {
      id: `mdns-${instanceName}.${svcType}.local`,
      host: state.foundHost || instanceName,
      ip,
      model: model || 'Network device',
      vendor: 'Unknown',
      service: svcType,
    })
    setTimeout(() => lookupProcess.kill(), 100)
  }

  function onClose() {
    if (ctx.emitted.has(key) || !state.foundHost) return
    lookup(state.foundHost, (err, address) => {
      if (!err && address) emit(address, '')
    })
  }

  lookupProcess.stdout?.on('data', (data: Buffer) => onResolveData(state, emit, data))
  lookupProcess.on('close', onClose)
  lookupProcess.stderr?.on('data', () => {})
  lookupProcess.on('error', () => {})
  setTimeout(() => lookupProcess.kill(), 6000)
}

function browseType(ctx: DnsSdContext, svcType: string): void {
  var lineBuffer = ''

  if (ctx.browsedTypes.has(svcType)) return
  ctx.browsedTypes.add(svcType)

  const browseProcess = spawn('dns-sd', ['-B', svcType, 'local'])
  ctx.runningProcesses.push(browseProcess)

  function onData(data: Buffer) {
    lineBuffer += data.toString()
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''
    lines.forEach((line) => {
      const match = line.match(/^\s*[\d:.]+\s+Add\s+\d+\s+\d+\s+\S+\s+\S+\s+(.+)$/)
      if (match) resolveInstance(ctx, match[1].trim(), svcType)
    })
  }

  browseProcess.stdout?.on('data', onData)
  browseProcess.stderr?.on('data', () => {})
  browseProcess.on('error', () => {})
}

function onMetaData(ctx: DnsSdContext, data: Buffer): void {
  ctx.metaLineBuffer += data.toString()
  const lines = ctx.metaLineBuffer.split('\n')
  ctx.metaLineBuffer = lines.pop() ?? ''
  lines.forEach((line) => {
    const match = line.match(
      /^\s*[\d:.]+\s+Add\s+\d+\s+\d+\s+\S+\s+_(tcp|udp)\.local\.\s+(_\S+)$/
    )
    if (match) browseType(ctx, `${match[2]}._${match[1]}`)
  })
}

export function startDnsSdScan(
  win: BrowserWindow,
  emitted: Set<string>
): (() => void) | null {
  if (platform() !== 'darwin') return null

  const ctx: DnsSdContext = {
    win,
    emitted,
    runningProcesses: [],
    browsedTypes: new Set(),
    resolvedInstances: new Set(),
    metaLineBuffer: '',
  }

  const metaDiscoveryProcess = spawn('dns-sd', ['-B', '_services._dns-sd._udp', 'local'])
  ctx.runningProcesses.push(metaDiscoveryProcess)

  metaDiscoveryProcess.stdout?.on('data', (data: Buffer) => onMetaData(ctx, data))
  metaDiscoveryProcess.stderr?.on('data', () => {})
  metaDiscoveryProcess.on('error', () => {})

  return () => killAll(ctx)
}
