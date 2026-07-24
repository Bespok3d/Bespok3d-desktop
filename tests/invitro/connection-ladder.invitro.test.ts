import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createConnection } from 'net'
import { checkDaemon, gradeReach } from '../../src/main/printers'
import type { PrinterRecord } from '../../src/main/printers'
import { fetchDaemonStatus } from '../../src/main/daemon-client/client'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'

// The connection LADDER (managed -> recoverable -> alive-no-ssh -> offline) driven against a REAL daemon
// over cert-pinned HTTPS, through the DeviceTarget seam so the same suite runs on Docker now and the U1
// bot later. The ladder's production composition is ipc.ts checkDaemonRecord:
//   1. daemonMetadata(record): record has token+cert AND checkDaemon(ip) [TCP 4269] AND the HTTP status
//      call answers  -> "managed".  (ipc.ts:231-258)
//   2. else gradeReach(probeWeb(ip), checkSshOpen(ip))  -> recoverable / alive-no-ssh / offline.
// checkDaemonRecord itself is an un-exported IPC-layer function that reads the record off disk; rather
// than drag the whole ipc.ts surface (+ a userData stub) into the in-vitro env, this mirrors the MANAGED
// GATE with the exact same real primitives (checkDaemon + fetchDaemonStatus) and the real gradeReach.
//
// SEAM-PORTABLE assertions only: daemonAnswers() flips true<->false with the real daemon up/down on BOTH
// Docker and the bot. The PATH to "not managed" differs by design and is NOT asserted: on the Docker
// device a killed daemon leaves host:4269 still accepting a TCP connect (docker-proxy), so checkDaemon
// stays true and the HTTP call is what fails (the wedged-daemon case the gate must not trust); on the
// real U1 a killed daemon refuses 4269, so checkDaemon itself returns false (clean-down). Both land on
// the same not-managed outcome, which is the robustness the HTTP gate buys. Requires Docker; off-gate.
const PORT = 2228
const QUERY_TIMEOUT = 4000
const harness = { target: null as DeviceTarget | null }

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
}, 90000)

afterAll(async () => {
  await harness.target?.teardown()
})

// The exact managed-gate composition from ipc.ts daemonMetadata: the daemon counts as managed only when
// the TCP port is reachable AND the HTTP status call answers. The record always carries token+cert here.
async function daemonAnswers(record: PrinterRecord): Promise<boolean> {
  if (!(await checkDaemon(record.ip))) return false
  try {
    await fetchDaemonStatus(record, QUERY_TIMEOUT)

    return true
  } catch {
    return false
  }
}

function tcpReachable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: timeoutMs })
    socket.on('connect', () => { socket.destroy(); resolve(true) })
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
    socket.on('error', () => resolve(false))
  })
}

describe('connection ladder: the managed gate against a real daemon', () => {
  it('grades managed when the real daemon answers (TCP 4269 open AND the HTTP status call responds)', async () => {
    const record = harness.target!.daemonRecord()
    expect(await checkDaemon(record.ip)).toBe(true)
    expect(await daemonAnswers(record)).toBe(true)
  })

  it('grades NOT managed when the daemon process is down, and managed again once it is restarted', async () => {
    const target = harness.target!
    const record = target.daemonRecord()

    await target.stopDaemon()
    // The HTTP call fails whether the port refuses (real U1) or accepts-then-resets (docker-proxy); either
    // way the managed gate must report the daemon as down rather than trust a held-open port.
    await expect(fetchDaemonStatus(record, QUERY_TIMEOUT)).rejects.toBeTruthy()
    expect(await daemonAnswers(record)).toBe(false)

    await target.startDaemon()
    expect(await daemonAnswers(record)).toBe(true)
  })
})

describe('connection ladder: sub-rung grading', () => {
  // recoverable = daemon down but SSH reachable (we can still repair/enroll). The Docker device remaps
  // the printer's ssh (22 -> host PORT), so the production checkSshOpen(ip) [hardcoded 22] cannot see it;
  // we read the device's real ssh surface at its host port and feed the REAL gradeReach, asserting the
  // rung MAPPING that checkDaemonRecord relies on. On the bot the ssh is at the production port 22, so
  // checkSshOpen(ip) feeds gradeReach directly - hence this Docker-port form is skipped on real-u1.
  it.skipIf(process.env.B3D_DEVICE_TARGET === 'real-u1')(
    'maps a daemon-down-but-ssh-reachable device to the recoverable rung', async () => {
      const sshUp = await tcpReachable('127.0.0.1', PORT, QUERY_TIMEOUT)
      expect(sshUp).toBe(true)
      expect(gradeReach(false, sshUp)).toBe('recoverable')
    })

  // The remaining rungs need device states the Docker daemon-device cannot publish (ssh down while web up
  // for alive-no-ssh; everything down for offline): finer container control / real hardware. Left as
  // RealU1/partial rather than faked. The pure rung mapping itself is unit-pinned in printers.test.ts.
})
