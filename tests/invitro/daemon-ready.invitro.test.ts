import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { getAdapter } from '@adapter-sdk'
import type { EnrollContext } from '@adapter-sdk'
import type { SshSession } from '../../src/main/ssh'
import { fetchCapabilities, fetchDaemonStatus } from '../../src/main/daemon-client/client'
import type { PrinterRecord } from '../../src/main/printers'
import {
  adapterFixture, startDaemonDevice, stopContainer, waitForSsh, copyDaemonSource,
  provisionDaemon, startDaemonProcess, daemonLog,
} from './fake-device'

const PORT = 2225
const fixture = adapterFixture('snapmaker-u1')
const harness = { container: '', ssh: null as SshSession | null, cert: '', token: '' }

function enrollContext(): EnrollContext {
  return {
    printerId: 'invitro',
    ip: '127.0.0.1',
    credentials: { user: fixture.ssh.user, password: fixture.ssh.password, port: PORT },
    runtimeUser: 'lava',
    onProgress: () => {},
  }
}

function daemonRecord(): PrinterRecord {
  return { ip: '127.0.0.1', daemonCert: harness.cert, daemonToken: harness.token } as unknown as PrinterRecord
}

function delay(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms))
}

async function waitForDaemon(attemptsLeft: number): Promise<void> {
  try {
    await fetchDaemonStatus(daemonRecord())
  } catch (error) {
    if (attemptsLeft <= 0) throw error
    await delay(500)

    return waitForDaemon(attemptsLeft - 1)
  }
}

beforeAll(async () => {
  harness.container = startDaemonDevice(PORT)
  harness.ssh = await waitForSsh(fixture, PORT)
  const ssh = harness.ssh
  const createWorkspace = getAdapter('snapmaker-u1')?.enrollSteps.find((step) => step.id === 'create-workspace')
  await createWorkspace!.run(ssh, enrollContext())
  copyDaemonSource(harness.container)
  const provisioned = await provisionDaemon(ssh)
  harness.cert = provisioned.cert
  harness.token = provisioned.token
  startDaemonProcess(harness.container)
  try {
    await waitForDaemon(40)
  } catch (error) {
    throw new Error(`daemon did not come up. Log:\n${daemonLog(harness.container)}`, { cause: error })
  }
}, 90000)

afterAll(() => {
  harness.ssh?.close()
  if (harness.container) stopContainer(harness.container)
})

// The bespok3d "ready to install plugins" state: the daemon is up and the app's REAL client reaches it
// over pinned-cert HTTPS with the bearer token, getting capabilities back.
describe('in-vitro: enrolled to ready-to-install (real daemon over the wire)', () => {
  it('serves a version over the authenticated, cert-pinned client', async () => {
    const status = await fetchDaemonStatus(daemonRecord())
    expect(typeof status.version).toBe('string')
    expect(status.version.length).toBeGreaterThan(0)
  })

  it('returns capabilities, so the store can install plugins', async () => {
    const caps = await fetchCapabilities(daemonRecord())
    expect(caps).toHaveProperty('installed')
    expect(caps).toHaveProperty('adapter')
  })
})
