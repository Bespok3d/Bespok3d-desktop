// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import type { BrowserWindow } from 'electron'

// Registers the klipper-linux adapter (both of its ids) into the adapter registry.
import '@adapters/klipper-linux/client/klipper-linux'
import { getAdapter } from '@adapter-sdk'
import type { AdapterDefinition, EnrollContext, EnrollStep } from '@adapter-sdk'
import { enrollPrinter } from '../../src/main/enrollment'
import type { EnrollProgressEvent } from '../../src/main/enrollment'
import { savePrinter, loadPrinters, removePrinter } from '../../src/main/printers'
import type { PrinterRecord } from '../../src/main/printers'
import { fetchCapabilities, fetchDaemonStatus, deactivateAll, recoverPackages, teardownDaemon } from '../../src/main/daemon-client/client'
import { waitForDaemon } from '../../src/main/ops/daemon-log'
import { connect } from '../../src/main/ssh'
import type { SshSession } from '../../src/main/ssh'

// The Klipper on Linux bench: a Debian VM shaped like MainsailOS (Klipper, Moonraker, a `pi` account
// whose sudo asks for its password), reached over forwarded ports. Inert unless B3D_BENCH_HOST is
// set, so the Docker suite and CI never look for it. Every call below is the SAME code the app runs:
// enrollPrinter, the daemon client, the adapter's own lifecycle steps.
//
//   B3D_DEV_SOURCES=<app root> B3D_BENCH_HOST=127.0.0.1 B3D_BENCH_PORT=2222 \
//     npx vitest run --config vitest.invitro.config.ts klipper-linux-bench

const benchHost = process.env.B3D_BENCH_HOST
const credentials = {
  user: process.env.B3D_BENCH_USER ?? 'pi',
  password: process.env.B3D_BENCH_PASSWORD ?? 'raspberry',
  port: Number(process.env.B3D_BENCH_PORT ?? '2222'),
}
const adapterId = process.env.B3D_BENCH_ADAPTER ?? 'voron-24'
const PRINTER_ID = 'bench-voron'
const ENROL_TIMEOUT_MS = 900_000

interface BenchCapabilities {
  adapter: string
  jinni_version: string
  capability_flags: string[]
  arch: string
  klipper_version: string
  firmware_version: string
}

const events: EnrollProgressEvent[] = []
const window = { webContents: { send: (_channel: string, event: EnrollProgressEvent) => { events.push(event) } } } as unknown as BrowserWindow

function failures(): EnrollProgressEvent[] {
  return events.filter((event) => event.status === 'failed')
}

function describeFailures(): string {
  return failures().map((event) => `${event.stepId}: ${event.error ?? ''}\n${event.errorDetail ?? ''}`).join('\n')
}

function record(): PrinterRecord {
  const loaded = loadPrinters().find((candidate) => candidate.id === PRINTER_ID)
  if (!loaded) throw new Error('the bench printer record is gone')

  return loaded
}

function opContext(adapter: AdapterDefinition): EnrollContext {
  const current = record()

  return {
    printerId: PRINTER_ID, ip: current.ip, credentials, runtimeUser: adapter.defaults.runtimeUser,
    daemonToken: current.daemonToken, daemonCert: current.daemonCert,
    onProgress: (hint: string) => console.log(`        ${hint}`),
  }
}

async function runSteps(steps: EnrollStep[], ssh: SshSession, ctx: EnrollContext, index = 0): Promise<void> {
  if (index >= steps.length) return
  console.log(`  [${steps[index].id}] ${steps[index].label}`)
  await steps[index].run(ssh, ctx)

  return runSteps(steps, ssh, ctx, index + 1)
}

async function withSession<T>(work: (ssh: SshSession) => Promise<T>): Promise<T> {
  const ssh = await connect({ host: benchHost as string, ...credentials })
  try {
    return await work(ssh)
  } finally {
    ssh.close()
  }
}

async function enrol(): Promise<void> {
  events.length = 0
  await enrollPrinter(window, PRINTER_ID, benchHost as string, adapterId, credentials)
  expect(failures(), describeFailures()).toEqual([])
}

const benchIt = benchHost ? it : it.skip

describe('Klipper on Linux bench: a Voron shaped host enrolled by the real app code', () => {
  benchIt('enrols the bench printer through every step of the adapter', async () => {
    removePrinter(PRINTER_ID)
    savePrinter({
      id: PRINTER_ID, nick: 'bench voron', model: 'Voron 2.4', adapter: adapterId,
      host: benchHost as string, ip: benchHost as string, status: 'online', installedIds: [],
    })

    await enrol()

    const enrolled = record()
    expect(enrolled.status).toBe('managed')
    expect(enrolled.daemonCert).toContain('BEGIN CERTIFICATE')
    expect(enrolled.enrollmentLog?.steps.map((step) => step.id)).toContain('verify')
  }, ENROL_TIMEOUT_MS)

  benchIt('the daemon it installed answers with this adapter and this jinni', async () => {
    const status = await fetchDaemonStatus(record())
    console.log(`  daemon ${JSON.stringify(status).slice(0, 200)}`)
    const caps = await fetchCapabilities(record()) as unknown as BenchCapabilities

    expect(caps.adapter).toBe(adapterId)
    expect(caps.jinni_version).toBe(getAdapter(adapterId)?.jinniVersion)
    expect(caps.capability_flags).toContain('managed-service')
    expect(caps.capability_flags).not.toContain('kernel-modules')
    expect(caps.arch).toBe('aarch64')
    expect(caps.klipper_version).not.toBe('unknown')
    console.log(`  capabilities ${JSON.stringify(caps).slice(0, 400)}`)
  }, 120_000)

  benchIt('leaves the printer running as the login user with the private files private', async () => {
    const listing = await withSession((ssh) => ssh.exec(
      'echo "daemon user: $(ps -o user= -p "$(systemctl show -p MainPID --value bespok3d)")";' +
      ' stat -c "%a %U %n" "$HOME/bespok3d/auth" "$HOME/bespok3d/auth/acl.json" "$HOME/bespok3d/etc/daemon/server.key" "$HOME/bespok3d/var/log/daemon.log";' +
      ' ls -la "$HOME/.bespok3d-enroll" 2>&1 | head -1; sudo -n true 2>&1 | head -1;' +
      ' systemctl is-enabled bespok3d bespok3d-plugins; grep -c "bespok3d/klipper" "$HOME/printer_data/config/printer.cfg"'
    ))
    console.log(listing)

    expect(listing).toContain('daemon user: pi')
    expect(listing).toMatch(/700 pi .*\/auth\n/)
    expect(listing).toMatch(/600 pi .*acl\.json/)
    expect(listing).toMatch(/600 pi .*server\.key/)
    expect(listing).toMatch(/daemon\.log/)
    expect(listing).toContain('No such file')
    expect(listing).toContain('a password is required')
  }, 60_000)

  benchIt('deactivates and reactivates through the adapter lifecycle and the daemon', async () => {
    const adapter = getAdapter(adapterId) as AdapterDefinition
    await deactivateAll(record())
    await withSession((ssh) => runSteps(adapter.lifecycle.deactivate, ssh, opContext(adapter)))
    const afterDeactivate = await withSession((ssh) => ssh.exec('systemctl is-enabled bespok3d 2>&1; systemctl is-active bespok3d 2>&1; true'))
    expect(afterDeactivate).toContain('disabled')
    expect(afterDeactivate).toContain('inactive')

    await withSession(async (ssh) => {
      await runSteps(adapter.lifecycle.reactivate, ssh, opContext(adapter))
      await waitForDaemon(benchHost as string, () => adapter.readDaemonLog(ssh))
    })
    const recovered = await recoverPackages(record())
    console.log(`  recover ${JSON.stringify(recovered).slice(0, 200)}`)
    expect((await fetchCapabilities(record()) as unknown as BenchCapabilities).adapter).toBe(adapterId)
  }, 300_000)

  benchIt('enrols the same printer a second time without touching the access list roles', async () => {
    const before = JSON.parse(await withSession((ssh) => ssh.exec('cat "$HOME/bespok3d/auth/acl.json"')))

    await enrol()

    // A bench that was enrolled by an earlier run holds that run's identity as admin and this one as
    // a user; a re-enrolment changes neither, and it never demotes the admin.
    const after = JSON.parse(await withSession((ssh) => ssh.exec('cat "$HOME/bespok3d/auth/acl.json"')))
    expect(after.roles).toEqual(before.roles)
    expect(Object.values(after.roles)).toContain('admin')
    expect((await fetchCapabilities(record()) as unknown as BenchCapabilities).adapter).toBe(adapterId)
  }, ENROL_TIMEOUT_MS)

  benchIt('removes Bespok3d and leaves the printer as it was', async () => {
    const adapter = getAdapter(adapterId) as AdapterDefinition
    await teardownDaemon(record())
    await withSession((ssh) => runSteps(adapter.lifecycle.remove, ssh, opContext(adapter)))

    const leftovers = await withSession((ssh) => ssh.exec(
      'for p in /etc/systemd/system/bespok3d.service /etc/systemd/system/bespok3d-plugins.service /etc/sudoers.d/bespok3d "$HOME/bespok3d" "$HOME/.bespok3d-enroll";' +
      ' do [ -e "$p" ] && echo "still there: $p" || echo "gone: $p"; done;' +
      ' systemctl is-active klipper moonraker; grep -c bespok3d "$HOME/printer_data/config/printer.cfg" "$HOME/printer_data/config/moonraker.conf" | tr "\\n" " "'
    ))
    console.log(leftovers)
    expect(leftovers).not.toContain('still there')
    expect(leftovers).toContain('active\nactive')
    expect(leftovers).toContain('printer.cfg:0')
    expect(leftovers).toContain('moonraker.conf:0')
    removePrinter(PRINTER_ID)
  }, 300_000)
})
