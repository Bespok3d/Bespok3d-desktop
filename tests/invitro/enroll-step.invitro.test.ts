import { describe, it, expect, beforeAll, afterAll } from 'vitest'
// The adapter is Electron main-process code; the invitro config aliases `electron` to a stub so it
// resolves its paths.json in the dev layout. These steps only need the ssh transport + a runtime user.
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { getAdapter } from '@adapter-sdk'
import type { EnrollContext, EnrollStep } from '@adapter-sdk'
import { shellQuote } from '../../src/main/ssh'
import type { SshSession } from '../../src/main/ssh'
import { adapterFixture, startContainer, stopContainer, waitForSsh } from './fake-device'

const PORT = 2223
const fixture = adapterFixture('snapmaker-u1')
const harness = { container: '', ssh: null as SshSession | null }

function enrollContext(): EnrollContext {
  return {
    printerId: 'invitro',
    ip: '127.0.0.1',
    credentials: { user: fixture.ssh.user, password: fixture.ssh.password, port: PORT },
    runtimeUser: 'lava',
    onProgress: () => {},
  }
}

function step(stepId: string): EnrollStep {
  const found = getAdapter('snapmaker-u1')?.enrollSteps.find((entry) => entry.id === stepId)
  if (!found) throw new Error(`enroll step ${stepId} not found`)

  return found
}

async function present(ssh: SshSession, path: string): Promise<string> {
  return (await ssh.exec(`test -e ${shellQuote(path)} && echo present`)).trim()
}

beforeAll(async () => {
  harness.container = startContainer(PORT)
  harness.ssh = await waitForSsh(fixture, PORT)
}, 60000)

afterAll(() => {
  harness.ssh?.close()
  if (harness.container) stopContainer(harness.container)
})

// Run the container-runnable real adapter steps and verify against the adapter's own declared
// postEnroll contract. The remaining postEnroll entries (var/lib/daemon, auth/acl.json, server.crt)
// need the daemon-deploy / cert / acl steps, which require a faithful runtime (next increment).
describe('in-vitro real adapter enroll steps + contract verification', () => {
  it('creates the workspace and installs the startup manager, matching the fixture postEnroll', async () => {
    const ssh = harness.ssh as SshSession
    await step('create-workspace').run(ssh, enrollContext())
    await step('deploy-s99').run(ssh, enrollContext())

    // postEnroll entries these two steps are expected to produce, taken from the adapter's fixture.
    const produced = [
      '/userdata/bespok3d/bin',
      '/userdata/bespok3d/etc/daemon',
      '/etc/init.d/S99bespok3d',
    ]
    produced.forEach((path) => {
      expect(fixture.postEnroll.dirs.concat(fixture.postEnroll.files)).toContain(path)
    })
    const checks = await Promise.all(produced.map((path) => present(ssh, path)))
    checks.forEach((output) => expect(output).toBe('present'))

    expect((await ssh.exec("stat -c '%U' /userdata/bespok3d/bin")).trim()).toBe('lava')
    expect((await ssh.exec("stat -c '%a' /etc/init.d/S99bespok3d")).trim()).toBe('755')
  })
})
