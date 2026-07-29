// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { packagedBinary, appEnv, rendererWindow, shoot } from './app-launch'
import { clickUntilGone, clickUntilVisible } from './click-through'
import { startContainer, stopContainer, waitForSsh, applySkeleton, seedDeviceFiles, seedDaemonVenv, adapterFixture, forwardDaemonPort } from '../tests/invitro/fake-device'

// Full onboarding through the REAL app against the in-vitro Docker device: discovery is skipped (the
// printer is seeded as online), then the app runs the real adapter enroll steps over real SSH and
// reaches a real MANAGED state, with the real daemon answering over cert-pinned HTTPS. The container's
// sshd is on host port 22 (Mac Remote Login off) so the enroll gate's TCP probe passes. The daemon port
// 4269 is deliberately NOT mapped: enroll verifies the daemon over SSH (PID check), and a mapped 4269
// would make docker-proxy answer the app's pre-enroll TCP probe, falsely flagging a daemon already
// present and routing to the access-request flow instead of enrollment.
//
// The container is a generic Linux box, so the firmware-fidelity steps are made to pass by scaffolding:
// the OEM files the steps read (S90lmd, nginx fluidd, printer.cfg, moonraker.conf) are stubbed, and the
// daemon venv is pre-seeded from the image's baked venv so deploy-daemon skips the slow PyPI build. The
// reboot step is a no-op the app tolerates (the container stays up). This is scaffolding for the parts a
// real U1 owns; the bespok3d flow itself (every SSH step, cert, ACL, daemon, the app reaching managed)
// is exercised for real.
const HOST_SSH_PORT = 22

function seedOnlinePrinter(userData: string): void {
  const printersDir = join(userData, 'printers')
  mkdirSync(printersDir, { recursive: true })
  const record = {
    id: 'onboard-u1', nick: 'New U1', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
    host: '127.0.0.1', ip: '127.0.0.1', status: 'online', installedIds: [],
    customSshCredentials: true,
  }
  writeFileSync(join(printersDir, 'onboard-u1.json'), JSON.stringify(record, null, 2), 'utf-8')
}

// Every step here is click-until-it-opened rather than click-and-hope: the printers pane repaints on
// each status poll, and the Enroll CTA it repaints is exactly the control this walk clicks.
async function openEnrollCredentials(window: Page): Promise<void> {
  const printersTab = window.getByRole('button', { name: 'Printers', exact: true }).first()
  const enrollCta = window.getByRole('button', { name: /Enroll/i }).first()
  await clickUntilVisible(window.getByRole('button', { name: 'Settings', exact: true }).first(), printersTab)
  await clickUntilVisible(printersTab, enrollCta)
  await clickUntilVisible(enrollCta, window.getByText('SSH password').first())
}

async function runEnrollment(window: Page): Promise<void> {
  await window.locator('input[type="text"]').last().fill('root')
  await window.locator('input[type="password"]').first().fill('test-root')
  await shoot(window, '41-enroll-credentials.png')
  await window.getByRole('button', { name: /Start enrollment/i }).first().click()
  await window.waitForTimeout(7000)
  await shoot(window, '42-enroll-progress.png')
  try {
    await window.getByText('Printer enrolled successfully').waitFor({ timeout: 180_000 })
  } catch (timeout) {
    await shoot(window, '42b-enroll-stuck.png')
    throw timeout
  }
  await shoot(window, '43-enroll-success.png')
  const done = window.getByRole('button', { name: 'Done', exact: true }).first()
  await clickUntilGone(done, done)
}

// With the daemon tunnel up, the app's periodic check (every ~15s) sees 4269 open and the printer flips
// to managed: the Settings row drops "Enroll" for the managed actions. We assert that flip, not just shoot.
async function confirmManaged(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'Deactivate', exact: true }).first().waitFor({ timeout: 40_000 })
  await expect(window.getByRole('button', { name: 'Enroll', exact: true })).toHaveCount(0)
  await shoot(window, '44-managed-ready.png')
}

test('captures onboarding through to managed', async () => {
  var closeTunnel: (() => void) | undefined
  // Room for the retry budgets in click-through.ts (three opens at 45s, one dismiss at 30s) on top of
  // the 180s enrollment wait, so a stuck step fails at the step with its own message instead of here.
  test.setTimeout(420_000)
  const container = startContainer(HOST_SSH_PORT)
  const userData = mkdtempSync(join(tmpdir(), 'b3-shots-onboard-'))
  try {
    const fixture = adapterFixture('snapmaker-u1')
    const ssh = await waitForSsh(fixture, HOST_SSH_PORT)
    await applySkeleton(ssh, fixture)
    seedDeviceFiles(container, fixture)
    await seedDaemonVenv(ssh, fixture)
    ssh.close()

    seedOnlinePrinter(userData)
    const app = await electron.launch({
      executablePath: packagedBinary(),
      args: [`--user-data-dir=${userData}`],
      env: appEnv(),
    })
    try {
      const window = await rendererWindow(app)
      await openEnrollCredentials(window)
      await runEnrollment(window)
      closeTunnel = await forwardDaemonPort(fixture, HOST_SSH_PORT)
      await confirmManaged(window)
    } finally {
      closeTunnel?.()
      await app.close()
    }
  } finally {
    stopContainer(container)
  }
})
