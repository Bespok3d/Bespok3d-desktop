import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { getAdapter } from '@adapter-sdk'
import type { EnrollContext } from '@adapter-sdk'
import { connect } from '../../src/main/ssh'
import type { SshSession } from '../../src/main/ssh'
import type { PrinterRecord } from '../../src/main/printers'
import type { ResolvedFixture } from '../../src/main/testkit/fixture'
import { fetchDaemonStatus } from '../../src/main/daemon-client/client'
import {
  adapterFixture, startDaemonDevice, stopContainer, waitForSsh, copyDaemonSource, deployAdapterJinni,
  applySkeleton, seedDeviceFiles, seedDaemonVenv, provisionDaemon, startDaemonProcess, stopDaemonProcess,
  daemonLog,
} from './fake-device'

// The recovery scenarios are written ONCE against this seam so they run against the Docker fake device
// today and the real U1 test bot when it arrives, with no rewrite. DockerDevice is live; RealU1Device is
// a stub until the bot is in hand (select it with B3D_DEVICE_TARGET=real-u1).
export interface DeviceSshCredentials {
  host: string
  port: number
  user: string
  password: string
}

export interface DeviceTarget {
  prepare(): Promise<void>          // bring up a daemon-ready device
  session(): SshSession             // an open SSH session, for adapter-level checks (verifyEnrolled)
  sshCredentials(): DeviceSshCredentials  // what an app op connects with when it opens its OWN session
  daemonRecord(): PrinterRecord     // cert/token/host the real daemon-client needs
  reachDaemon(): Promise<void>      // ensure 4269 is reachable from the test host (Docker: no-op)
  stopDaemon(): Promise<void>       // clean daemon-down
  startDaemon(): Promise<void>      // bring the daemon back (the repair half)
  resetWriteLayer(): Promise<void>  // simulate a firmware OTA resetting the overlay (rm /oem/.debug)
  downgradeDaemon(version: string): Promise<void>  // age the RUNNING daemon so an update has real work
  ageDeployedDaemon(version: string): Promise<void>  // break the tree the APP deployed, so only a redeploy fixes it
  teardown(): Promise<void>
}

// The on-device layout both targets share: the workspace the adapter's enroll step builds, the autostart
// script the app's deploy installs (and drives the daemon through afterwards), and the file the daemon's
// health route reports its version from.
const DEVICE_WORKSPACE = '/userdata/bespok3d'
export const DEVICE_AUTOSTART = `${DEVICE_WORKSPACE}/etc/init.d/autostart/s10bespok3d-daemon`
const DEVICE_VERSION_FILE = `${DEVICE_WORKSPACE}/var/lib/daemon/version.py`

function delay(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms))
}

class DockerDevice implements DeviceTarget {
  private fixture: ResolvedFixture = adapterFixture('snapmaker-u1')
  private container = ''
  private ssh: SshSession | null = null
  private cert = ''
  private token = ''

  constructor(private port: number) {}

  private enrollContext(): EnrollContext {
    return {
      printerId: 'invitro', ip: '127.0.0.1',
      credentials: { user: this.fixture.ssh.user, password: this.fixture.ssh.password, port: this.port },
      runtimeUser: 'lava', onProgress: () => {},
    }
  }

  private async waitForDaemon(attemptsLeft: number): Promise<void> {
    try {
      await fetchDaemonStatus(this.daemonRecord())
    } catch (error) {
      if (attemptsLeft <= 0) throw new Error(`daemon did not come up. Log:\n${daemonLog(this.container)}`, { cause: error })
      await delay(500)

      return this.waitForDaemon(attemptsLeft - 1)
    }
  }

  async prepare(): Promise<void> {
    this.container = startDaemonDevice(this.port)
    this.ssh = await waitForSsh(this.fixture, this.port)
    // Lay down the adapter's firmware skeleton (real dirs like /oem + factory configs) so write-layer
    // checks run against real shapes, then the real create-workspace step builds the bespok3d tree.
    await applySkeleton(this.ssh, this.fixture)
    seedDeviceFiles(this.container, this.fixture)
    const createWorkspace = getAdapter('snapmaker-u1')?.enrollSteps.find((step) => step.id === 'create-workspace')
    await createWorkspace!.run(this.ssh, this.enrollContext())
    // Seed the adapter-declared venv from the image's baked one. A suite that drives the app's REAL
    // deploy-daemon step reaches ensureVenv/installVenvDeps, which would otherwise build a venv and pull
    // fastapi from PyPI inside the container. Both are guarded by an existence check, so a seeded venv
    // makes them no-ops; the deploy step itself still runs for real.
    await seedDaemonVenv(this.ssh, this.fixture)
    copyDaemonSource(this.container)
    // Deploy the adapter's real jinni (as enrollment does) so the daemon runs on the device's actual
    // paths, not GenericJinni. Without it ops that read PRINTER_CFG/MOONRAKER_CFG (deactivate/teardown)
    // KeyError into a 500. The real U1 already has its jinni from enrollment, so this is Docker-only.
    deployAdapterJinni(this.container, 'snapmaker-u1')
    const provisioned = await provisionDaemon(this.ssh)
    this.cert = provisioned.cert
    this.token = provisioned.token
    await this.startDaemon()
  }

  session(): SshSession {
    if (!this.ssh) throw new Error('call prepare() before session()')

    return this.ssh
  }

  sshCredentials(): DeviceSshCredentials {
    return { host: '127.0.0.1', port: this.port, user: this.fixture.ssh.user, password: this.fixture.ssh.password }
  }

  daemonRecord(): PrinterRecord {
    return { ip: '127.0.0.1', daemonCert: this.cert, daemonToken: this.token } as unknown as PrinterRecord
  }

  async reachDaemon(): Promise<void> {
    // The Docker device publishes 4269, so the daemon is already reachable; nothing to forward.
  }

  // Clean daemon-down whichever way the daemon is currently running: the fixture's own detached process
  // (prepare), and, once the app's update path has deployed it, the autostart script that owns the
  // daemon from then on. Both are addressed by pid, so neither depends on the port tooling the base
  // image lacks.
  async stopDaemon(): Promise<void> {
    stopDaemonProcess(this.container)
    await this.session().exec(`[ -x ${DEVICE_AUTOSTART} ] && ${DEVICE_AUTOSTART} stop; true`)
  }

  async startDaemon(): Promise<void> {
    startDaemonProcess(this.container)
    await this.waitForDaemon(40)
  }

  async resetWriteLayer(): Promise<void> {
    await this.session().exec('rm -f /oem/.debug')
  }

  // Rewrite the version constant the daemon's health route reports, then restart it, so the device
  // genuinely answers as an older daemon. Only the DEVICE's starting state is aged: this touches the
  // fixture copy under /daemon, while the app's update path deploys to DAEMON_BASE and starts from
  // there, so the expected version can only reach the device through the app's own code.
  async downgradeDaemon(version: string): Promise<void> {
    await this.session().putContent('/daemon/version.py', `DAEMON_VERSION = "${version}"\n`)
    stopDaemonProcess(this.container)
    await this.startDaemon()
  }

  // The broken printer a user runs Repair on: the daemon is down AND the deployed tree reports a stale
  // version. Restarting what is already there therefore fails the op's own verify-daemon, so the repair
  // can only go green by genuinely re-uploading source. Ages the tree the app's deploy-daemon owns, not
  // the fixture copy downgradeDaemon touches.
  async ageDeployedDaemon(version: string): Promise<void> {
    await this.session().putContent(DEVICE_VERSION_FILE, `DAEMON_VERSION = "${version}"\n`)
    await this.stopDaemon()
  }

  async teardown(): Promise<void> {
    this.ssh?.close()
    if (this.container) stopContainer(this.container)
  }
}

// The real U1 test bot ("junior"), already enrolled. The same suite, pointed at hardware on the LAN via
// B3D_HIL_HOST. Unlike the Docker device, the bot is already managed, so prepare() reads the daemon cert
// + a token straight off the device (server.crt + auth/acl.json) rather than provisioning them, and the
// daemon is driven through its installed autostart script. teardown() restores the overlay flag + daemon
// so a destructive run never strands the shared bot. See doc/testing.md "Hardware-in-the-loop".
function botConnectOptions(): DeviceSshCredentials {
  return {
    host: process.env.B3D_HIL_HOST ?? '192.0.2.109',
    port: Number(process.env.B3D_HIL_PORT ?? '22'),
    user: process.env.B3D_HIL_USER ?? 'root',
    password: process.env.B3D_HIL_PASSWORD ?? 'snapmaker',
  }
}

class RealU1Device implements DeviceTarget {
  private ssh: SshSession | null = null
  private cert = ''
  private token = ''
  private trueVersionFile = ''

  private async waitForDaemon(attemptsLeft: number): Promise<void> {
    try {
      await fetchDaemonStatus(this.daemonRecord())
    } catch (statusError) {
      if (attemptsLeft <= 0) throw new Error(`bot daemon did not answer on ${botConnectOptions().host}`, { cause: statusError })
      await delay(1000)

      return this.waitForDaemon(attemptsLeft - 1)
    }
  }

  async prepare(): Promise<void> {
    this.ssh = await connect(botConnectOptions())
    this.cert = await this.ssh.getContent(`${DEVICE_WORKSPACE}/etc/daemon/server.crt`)
    const acl = JSON.parse(await this.ssh.getContent(`${DEVICE_WORKSPACE}/auth/acl.json`))
    const firstToken = acl.tokens?.[0]
    if (!firstToken) throw new Error(`no daemon token in ${DEVICE_WORKSPACE}/auth/acl.json; is the bot enrolled?`)
    this.token = firstToken
    await this.startDaemon()
  }

  session(): SshSession {
    if (!this.ssh) throw new Error('call prepare() before session()')

    return this.ssh
  }

  sshCredentials(): DeviceSshCredentials {
    return botConnectOptions()
  }

  daemonRecord(): PrinterRecord {
    return { ip: botConnectOptions().host, daemonCert: this.cert, daemonToken: this.token } as unknown as PrinterRecord
  }

  async reachDaemon(): Promise<void> {
    // The bot's daemon listens on 4269 directly on the LAN segment; nothing to forward.
  }

  async stopDaemon(): Promise<void> {
    await this.session().exec(`${DEVICE_AUTOSTART} stop`)
  }

  async startDaemon(): Promise<void> {
    await this.session().exec(`${DEVICE_AUTOSTART} start`)
    await this.waitForDaemon(40)
  }

  async resetWriteLayer(): Promise<void> {
    await this.session().exec('rm -f /oem/.debug')
  }

  // Same contract as the Docker device, on shared hardware.
  async downgradeDaemon(version: string): Promise<void> {
    await this.ageDeployedDaemon(version)
    await this.startDaemon()
  }

  // On the bot there is only ever the deployed tree, so ageing it IS the downgrade; the difference is
  // that this one leaves the daemon down for the repair path to bring back. Keeps the bot's real version
  // file so teardown can put it back even when a run dies mid-suite: an update test overwrites it with
  // the true source anyway, this covers the run that never gets that far.
  async ageDeployedDaemon(version: string): Promise<void> {
    this.trueVersionFile = await this.session().getContent(DEVICE_VERSION_FILE)
    await this.session().putContent(DEVICE_VERSION_FILE, `DAEMON_VERSION = "${version}"\n`)
    await this.stopDaemon()
  }

  private async restoreTrueVersion(): Promise<void> {
    if (!this.trueVersionFile) return
    await this.session().putContent(DEVICE_VERSION_FILE, this.trueVersionFile)
    this.trueVersionFile = ''
  }

  // Best-effort restore so a destructive run leaves the shared bot enrolled + persistent: put back the
  // real version file, re-touch the overlay flag the OTA-sim removed, and bring the daemon back. Log
  // (never swallow) a restore failure.
  private async restoreBot(): Promise<void> {
    try {
      await this.restoreTrueVersion()
      await this.session().exec('touch /oem/.debug')
      await this.startDaemon()
    } catch (restoreError) {
      console.warn(`[hil] teardown could not restore the bot on ${botConnectOptions().host}: ${String(restoreError)}`)
    }
  }

  async teardown(): Promise<void> {
    if (!this.ssh) return
    await this.restoreBot()
    this.ssh.close()
  }
}

export function makeDeviceTarget(dockerPort: number): DeviceTarget {
  if (process.env.B3D_DEVICE_TARGET === 'real-u1') return new RealU1Device()

  return new DockerDevice(dockerPort)
}
