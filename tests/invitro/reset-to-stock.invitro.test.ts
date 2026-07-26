import { rmSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import { describe, it, expect } from 'vitest'

import { connect } from '../../src/main/ssh'
import type { SshSession } from '../../src/main/ssh'
import { teardownDaemon } from '../../src/main/daemon-client/client'
import type { PrinterRecord } from '../../src/main/printers'

// Headless reset-to-stock for the CI/CD bed: take an enrolled printer back to MINT stock, reusing the
// canonical teardown (no reimplementation). It runs the daemon's own teardown (reverts every plugin's
// source patches, strips the [include bespok3d/...] lines, prunes the config dir, restarts Klipper +
// Moonraker), then the SSH-side reversal the app's runUninstall does (un-hook S90lmd, un-include nginx,
// remove S99/udev/dhcpcd/workspace), then reboots so the display + boot come up fully stock, and finally
// verifies zero bespok3d residue. Inert unless B3D_RESET_TARGET is set, so CI never wipes a device by
// accident. Flashing / A-B-slot reset is a later, harder capability; this is the software mint.
//
//   B3D_DEV_SOURCES=<workspace-root> B3D_RESET_TARGET=192.0.2.66 \
//     npx vitest run --config vitest.invitro.config.ts reset-to-stock

const target = process.env.B3D_RESET_TARGET
const sshUser = process.env.B3D_RESET_USER ?? 'root'
const sshPassword = process.env.B3D_RESET_PASSWORD ?? 'snapmaker'
const sshPort = Number(process.env.B3D_RESET_PORT ?? '22')
// The bot's IP can flap (DHCP reservation vs other leases is a fact of the bench), so after the reboot we
// look for it across the target plus any alternates before giving up.
const reconnectCandidates = [target, ...(process.env.B3D_RESET_ALT_IPS ?? '192.0.2.66,192.0.2.109').split(',')]
  .filter((ip): ip is string => Boolean(ip))

const WORKSPACE = '/userdata/bespok3d'

function connectOptions(host: string): { host: string; port: number; user: string; password: string } {
  return { host, port: sshPort, user: sshUser, password: sshPassword }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function readDaemonRecord(ssh: SshSession): Promise<PrinterRecord> {
  const cert = await ssh.getContent(`${WORKSPACE}/etc/daemon/server.crt`).catch(() => '')
  const aclText = await ssh.getContent(`${WORKSPACE}/auth/acl.json`).catch(() => '{}')
  const token = (JSON.parse(aclText).tokens ?? [])[0] ?? ''

  return { ip: target as string, daemonCert: cert, daemonToken: token } as unknown as PrinterRecord
}

// Best-effort: the daemon reverts source patches + strips includes + prunes the config dir + restarts the
// core services. If the daemon is wedged we still mint via the SSH reversal + reboot, so a dead daemon
// never blocks the reset; it only means source patches lean on the reboot/stock reload instead.
async function canonicalDaemonTeardown(ssh: SshSession): Promise<string> {
  const record = await readDaemonRecord(ssh)
  if (!record.daemonCert || !record.daemonToken) return 'skipped (no daemon creds on device)'
  try {
    await teardownDaemon(record)

    return 'ok'
  } catch (teardownError) {
    return `skipped (daemon unreachable: ${String(teardownError)})`
  }
}

// The SSH-side reversal of enrollment, mirroring the app's runUninstall (printer-ops.ts), plus one CI
// extra: nuke the bespok3d config dir outright. The app's teardown PRESERVES user .cfg files there (so it
// leaves the empty main.cfg placeholders behind), but a test bot has no user files, so a true mint removes
// the whole dir. When a third consumer appears this belongs in a shared adapter reset module; two copies
// stays under rule-of-three.
async function reverseEnrollmentArtifacts(ssh: SshSession): Promise<void> {
  await ssh.exec(`${WORKSPACE}/etc/init.d/autostart/s10bespok3d-daemon stop 2>/dev/null || true`)
  await ssh.exec(
    `sed -i '/S99bespok3d/d' /etc/init.d/S90lmd` +
      ` ; sed -i '/bespok3d\\/etc\\/nginx\\/locations/d' /etc/nginx/sites-enabled/fluidd` +
      ` ; rm -f /etc/init.d/S99bespok3d` +
      ` ; rm -f /etc/udev/rules.d/70-wlan0-mac.rules` +
      ` ; rm -rf /oem/printer_data/config/bespok3d` +
      ` ; rm -rf ${WORKSPACE}` +
      // enrollment moved /var/db/dhcpcd into the workspace (now removed) via a symlink; drop the dangling
      // symlink AND restore a real dir, or dhcpcd has no state dir on the next boot and cannot lease -> the
      // printer reboots with no network. The app's runUninstall (printer-ops.ts) needs this same fix.
      ` ; rm -f /var/db/dhcpcd ; mkdir -p /var/db/dhcpcd` +
      // Clear the overlay write-layer flag for a TRUE mint: stock has no /oem/.debug, and on the next boot
      // its absence resets the overlay upper to pristine squashfs, reverting every remaining rootfs change
      // (incl. /home/lava source patches). /oem + /userdata are ext4 and persist, so wifi creds in
      // /oem/printer_data/gui survive and the bot reconnects. The app's runUninstall also leaves this set.
      ` ; rm -f /oem/.debug`
  )
}

async function firstReachable(candidates: string[]): Promise<SshSession | null> {
  function tryConnect(host: string): Promise<SshSession | null> {
    return connect(connectOptions(host)).catch(() => null)
  }
  const sessions = await Promise.all(candidates.map(tryConnect))

  return sessions.find((session): session is SshSession => session !== null) ?? null
}

async function reconnectAfterReboot(attemptsLeft: number): Promise<SshSession> {
  if (attemptsLeft <= 0) throw new Error('bot did not come back after the reset reboot')
  await sleep(3000)
  const session = await firstReachable(reconnectCandidates)

  return session ?? reconnectAfterReboot(attemptsLeft - 1)
}

async function collectResidue(ssh: SshSession): Promise<string> {
  return (
    await ssh.exec(
      `{ test -e ${WORKSPACE} && echo workspace;` +
        ` test -e /etc/init.d/S99bespok3d && echo s99bespok3d;` +
        ` test -e /oem/.debug && echo overlay-debug-flag;` +
        ` test -e /oem/printer_data/config/bespok3d && echo config-dir;` +
        ` grep -lE 'S99bespok3d' /etc/init.d/S90lmd 2>/dev/null;` +
        ` grep -lE 'bespok3d/etc/nginx/locations' /etc/nginx/sites-enabled/fluidd 2>/dev/null;` +
        ` grep -lE 'include bespok3d' /oem/printer_data/config/printer.cfg /oem/printer_data/config/moonraker.conf 2>/dev/null;` +
        ` } 2>/dev/null; true`
    )
  ).trim()
}

// SSH (dropbear) comes up well before Klipper after a reboot, so poll rather than read once.
async function waitKlipperReady(ssh: SshSession, attemptsLeft: number): Promise<boolean> {
  const info = await ssh.exec('wget -qO- http://127.0.0.1:7125/server/info 2>/dev/null || true').catch(() => '')
  if (info.includes('"klippy_state": "ready"')) return true
  if (attemptsLeft <= 0) return false
  await sleep(3000)

  return waitKlipperReady(ssh, attemptsLeft - 1)
}

// Drop the app's managed record for the bot so the desktop app rediscovers it as a fresh stock printer.
function removeManagedRecord(): void {
  const printerId = process.env.B3D_RESET_RECORD_ID
  if (!printerId) return
  const base = join(homedir(), 'Library', 'Application Support')
  ;['bespok3d', 'Bespok3d Dev'].forEach((productName) => {
    const recordPath = join(base, productName, 'printers', `${printerId}.json`)
    if (existsSync(recordPath)) {
      rmSync(recordPath)
      console.log(`cleared managed record: ${recordPath}`)
    }
  })
}

const resetIt = target ? it : it.skip

describe('headless reset-to-stock (CI mint)', () => {
  resetIt(
    'reverts an enrolled printer to mint stock and comes back clean',
    async () => {
      const ssh = await connect(connectOptions(target as string))
      const daemonTeardown = await canonicalDaemonTeardown(ssh)
      console.log(`daemon teardown: ${daemonTeardown}`)
      await reverseEnrollmentArtifacts(ssh)
      console.log('enrollment artifacts reversed; rebooting for clean stock...')
      await ssh.exec('reboot').catch(() => undefined)

      const back = await reconnectAfterReboot(40)
      const residue = await collectResidue(back)
      const ready = await waitKlipperReady(back, 20)
      back.close()

      console.log(`post-reset residue: ${residue || '(none)'}`)
      console.log(`klipper ready after reset: ${ready}`)
      expect(residue).toBe('')

      removeManagedRecord()
    },
    900000
  )
})
