import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { verifyEnrolled, writeLayerActive } from '@adapters/snapmaker-u1/client/snapmaker-u1'
import { fetchCapabilities, fetchDaemonStatus, recoverPackages } from '../../src/main/daemon-client/client'
import { makeDeviceTarget } from './device-target'
import type { DeviceTarget } from './device-target'

// The CORE recovery procedures driven against a REAL daemon over cert-pinned HTTPS, written against the
// DeviceTarget seam so the same suite runs on Docker now and the U1 test bot later. Requires Docker; runs
// via scripts/invitro.sh, off the fast gate.
const PORT = 2226
const harness = { target: null as DeviceTarget | null }

beforeAll(async () => {
  harness.target = makeDeviceTarget(PORT)
  await harness.target.prepare()
}, 90000)

afterAll(async () => {
  await harness.target?.teardown()
})

describe('in-vitro recovery procedures (real daemon over the wire)', () => {
  it('daemon-down -> repair: the client loses the daemon when it is killed and regains it when restarted', async () => {
    const target = harness.target!
    const before = await fetchDaemonStatus(target.daemonRecord())
    expect(before.version.length).toBeGreaterThan(0)

    await target.stopDaemon()
    await expect(fetchDaemonStatus(target.daemonRecord())).rejects.toBeTruthy()

    await target.startDaemon()
    const after = await fetchDaemonStatus(target.daemonRecord())
    expect(after.version.length).toBeGreaterThan(0)
  })

  it('post-OTA -> recover: verifyEnrolled flips from true to false once the overlay write layer is reset', async () => {
    const target = harness.target!
    const ssh = target.session()

    // The enrolled, intact state: the overlay flag is present and the workspace exists.
    await ssh.exec('touch /oem/.debug')
    expect(await writeLayerActive(ssh)).toBe(true)
    expect(await verifyEnrolled(ssh)).toBe(true)

    // A firmware OTA resets the overlay; the workspace survives but the flag is gone.
    await target.resetWriteLayer()
    expect(await writeLayerActive(ssh)).toBe(false)
    // This is exactly the signal the app keys on to offer full Recover instead of a hollow Repair.
    expect(await verifyEnrolled(ssh)).toBe(false)
  })

  it('recover runs over the wire and leaves the printer usable (the daemon still answers)', async () => {
    const target = harness.target!
    const result = await recoverPackages(target.daemonRecord())
    expect(result).toHaveProperty('results')

    const caps = await fetchCapabilities(target.daemonRecord())
    expect(caps).toHaveProperty('installed')
  })
})
