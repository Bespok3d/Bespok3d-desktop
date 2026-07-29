// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { shellQuote } from '../../src/main/ssh'
import type { SshSession } from '../../src/main/ssh'
import { adapterFixture, startContainer, stopContainer, waitForSsh, applySkeleton, seedDeviceFiles } from './fake-device'

const PORT = 2222
const fixture = adapterFixture('snapmaker-u1')
const harness = { container: '', ssh: null as SshSession | null }

beforeAll(async () => {
  harness.container = startContainer(PORT)
  harness.ssh = await waitForSsh(fixture, PORT)
  await applySkeleton(harness.ssh, fixture)
  seedDeviceFiles(harness.container, fixture)
}, 60000)

afterAll(() => {
  harness.ssh?.close()
  if (harness.container) stopContainer(harness.container)
})

describe('in-vitro fake device (real SSH transport, adapter-declared fixture)', () => {
  it('applies every declared skeleton directory', async () => {
    const ssh = harness.ssh as SshSession
    const checks = await Promise.all(
      fixture.skeleton.dirs.map((dir) => ssh.exec(`test -d ${shellQuote(dir)} && echo present`)),
    )
    checks.forEach((output) => expect(output.trim()).toBe('present'))
  })

  it('writes declared skeleton files with their content', async () => {
    const ssh = harness.ssh as SshSession
    expect((await ssh.getContent('/etc/FULLVERSION')).trim()).toBe('1.4.0.246')
  })

  it('lands the verbatim seed tree, sanitized to stock', async () => {
    const ssh = harness.ssh as SshSession
    const printerCfg = await ssh.getContent('/oem/printer_data/config/printer.cfg')
    expect(printerCfg).toContain('#*# <---------------------- SAVE_CONFIG')
    const moonrakerConf = await ssh.getContent('/oem/printer_data/config/moonraker.conf')
    expect(moonrakerConf).not.toContain('include extended')
    expect((await ssh.exec('test -x /etc/init.d/S90lmd && echo ok')).trim()).toBe('ok')
  })
})
