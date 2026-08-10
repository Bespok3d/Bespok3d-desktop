// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { Client } from 'ssh2'
import { createServer } from 'net'
import { DAEMON_PACKAGE, ADAPTER_JINNI_PACKAGE } from '@adapters/snapmaker-u1/client/packages'
import type { Socket } from 'net'
import { connect, shellQuote } from '../../src/main/ssh'
import type { SshSession } from '../../src/main/ssh'
import { openBundledPackage } from '../../src/main/store/bundled-package'
import { loadFixture } from '../../src/main/testkit/fixture'
import type { ResolvedFixture } from '../../src/main/testkit/fixture'

const DAEMON_PORT = 4269
// Where the device's starting-state daemon runs from, and the python it runs on. The app's own deploy
// installs to DAEMON_BASE under the workspace instead, which is what keeps the update and repair paths
// honest: those tests can only go green by deploying, never by finding this copy.
const DEVICE_DAEMON_DIR = '/daemon'
const DEVICE_VENV = '/opt/bespok3d-venv'

// The generic fake-device harness: start the base container, drive it with the app's REAL ssh transport,
// apply an adapter's declared firmware skeleton, tear down. Nothing here knows any specific device; the
// fixture comes from the adapter (loadFixture). Requires Docker (run via scripts/invitro.sh).

export const FAKE_IMAGE = 'bespok3d/fake-printer-base:latest'

export function adapterFixture(adapterId: string): ResolvedFixture {
  return loadFixture(resolve(process.cwd(), '../adapters', adapterId))
}

export function startContainer(port: number): string {
  const args = ['run', '-d', '--rm', '-p', `${port}:22`, FAKE_IMAGE]

  return execFileSync('docker', args, { encoding: 'utf8' }).trim()
}

export function stopContainer(containerId: string): void {
  execFileSync('docker', ['rm', '-f', containerId], { stdio: 'ignore' })
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((done) => setTimeout(done, milliseconds))
}

// sshd takes a moment to accept connections after the container starts; retry the real connect.
async function tryConnect(fixture: ResolvedFixture, port: number, attemptsLeft: number): Promise<SshSession> {
  try {
    return await connect({ host: '127.0.0.1', port, user: fixture.ssh.user, password: fixture.ssh.password })
  } catch (connectionError) {
    if (attemptsLeft <= 0) throw connectionError
    await delay(500)

    return tryConnect(fixture, port, attemptsLeft - 1)
  }
}

export function waitForSsh(fixture: ResolvedFixture, port: number): Promise<SshSession> {
  return tryConnect(fixture, port, 40)
}

function pipeForward(client: Client, socket: Socket): void {
  client.forwardOut('127.0.0.1', 0, '127.0.0.1', DAEMON_PORT, (forwardError, stream) => {
    if (forwardError) return socket.destroy()
    socket.pipe(stream).pipe(socket)
  })
}

function listenForward(client: Client, localPort: number, ready: (close: () => void) => void, fail: (error: Error) => void): void {
  const server = createServer((socket) => pipeForward(client, socket))
  server.on('error', fail)
  server.listen(localPort, '127.0.0.1', () => ready(() => { server.close(); client.end() }))
}

// Forward host 127.0.0.1:<localPort> to the container daemon's localhost:4269 over SSH. Used AFTER
// enrollment so the pre-enroll TCP probe still sees 4269 closed (a docker-published 4269 answers the
// probe even with nothing bound inside, falsely flagging a daemon and routing to access-request). With
// the tunnel up, the app's managed check reaches the real cert-pinned daemon and the printer goes managed.
export function forwardDaemonPort(fixture: ResolvedFixture, sshPort: number, localPort: number = DAEMON_PORT): Promise<() => void> {
  const client = new Client()

  return new Promise((ready, fail) => {
    client.on('error', fail)
    client.on('ready', () => listenForward(client, localPort, ready, fail))
    client.connect({ host: '127.0.0.1', port: sshPort, username: fixture.ssh.user, password: fixture.ssh.password })
  })
}

async function placeFile(ssh: SshSession, path: string, content: string): Promise<void> {
  await ssh.exec(`mkdir -p ${shellQuote(dirname(path))}`)
  await ssh.putContent(path, content)
}

export async function applySkeleton(ssh: SshSession, fixture: ResolvedFixture): Promise<void> {
  await Promise.all(fixture.skeleton.dirs.map((dir) => ssh.exec(`mkdir -p ${shellQuote(dir)}`)))
  await Promise.all(fixture.skeleton.files.map((file) => placeFile(ssh, file.path, file.content)))
}

// Copy the adapter's verbatim seed tree (real captured device files) onto the container root. The tree
// mirrors the device filesystem, so `<seedDir>/.` -> `<container>:/` lands each file at its real path.
export function seedDeviceFiles(containerId: string, fixture: ResolvedFixture): void {
  if (!fixture.seedDir) return
  execFileSync('docker', ['cp', `${fixture.seedDir}/.`, `${containerId}:/`])
}

// Block the current thread without spawning a process, so the sync docker-run retry can back off.
function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

// `docker rm -f` returns before docker-proxy releases the host port binding, so the next daemon-device
// file's `docker run -p 4269:4269` can briefly race the prior file's teardown and fail with "port is
// already allocated" (the daemon-client hardcodes :4269, so every daemon device must publish that one
// host port). Retry on exactly that error with a short backoff; any other failure throws immediately.
function runDockerDevice(args: string[], attemptsLeft: number): string {
  try {
    return execFileSync('docker', args, { encoding: 'utf8' }).trim()
  } catch (runError) {
    const stderr = String((runError as { stderr?: string }).stderr ?? (runError as Error).message ?? runError)
    if (attemptsLeft <= 0 || !/port is already allocated|address already in use/i.test(stderr)) throw runError
    sleepSync(500)

    return runDockerDevice(args, attemptsLeft - 1)
  }
}

// A fake device with the daemon port mapped too, so the app's real daemon-client can reach the daemon.
export function startDaemonDevice(sshPort: number): string {
  const args = ['run', '-d', '--rm', '-p', `${sshPort}:22`, '-p', '4269:4269', FAKE_IMAGE]

  return runDockerDevice(args, 10)
}

// Write one package's payload into a staging directory, exactly as the payload declares it. The bytes
// come through the app's verified reader, so a package whose signature does not check out stops the
// suite here rather than being copied into the container.
async function stagePackagePayload(packageName: string, stagingDir: string): Promise<void> {
  const bundled = await openBundledPackage(packageName)
  bundled.payloadPaths.forEach((payloadPath) => {
    const stagedPath = join(stagingDir, payloadPath)
    mkdirSync(dirname(stagedPath), { recursive: true })
    writeFileSync(stagedPath, bundled.payloadBytes(payloadPath))
  })
}

// The device's starting-state runtime, laid down the way a user's machine lays it down: out of the two
// signed packages this build ships (the daemon and the adapter's jinni, which carries the shared
// klipper runtime under jinni/), never out of a source tree that only exists in a checkout. The venv is
// built from the wheels the daemon package carries, offline, with pip's index and resolver switched
// off, so the image needs no network and a missing wheel fails here instead of on a printer.
export async function installDaemonFromPackages(containerId: string): Promise<void> {
  const stagingDir = mkdtempSync(join(tmpdir(), 'invitro-daemon-'))
  await stagePackagePayload(DAEMON_PACKAGE, stagingDir)
  await stagePackagePayload(ADAPTER_JINNI_PACKAGE, stagingDir)
  execFileSync('docker', ['exec', containerId, 'mkdir', '-p', DEVICE_DAEMON_DIR])
  execFileSync('docker', ['cp', `${stagingDir}/.`, `${containerId}:${DEVICE_DAEMON_DIR}`])
  execFileSync('docker', ['exec', containerId, 'sh', '-c',
    `python3 -m venv ${DEVICE_VENV} && ${DEVICE_VENV}/bin/pip install --no-index --no-deps ${DEVICE_DAEMON_DIR}/wheels/*.whl`])
}

const DAEMON_TOKEN = 'invitrotoken0123456789abcdef0123'
const WORKSPACE = '/userdata/bespok3d'

// Bring the bespok3d daemon up the way it runs on device: a self-signed cert + an ACL token in the
// workspace, then the real daemon process. Returns what the app's client needs to reach it. NOTE this
// provisions cert/acl directly (a device-side adapter concern); the point under test is the bespok3d
// daemon + the app reaching it, not the adapter's cert/acl mechanics.
export async function provisionDaemon(ssh: SshSession): Promise<{ cert: string; token: string }> {
  const certDir = `${WORKSPACE}/etc/daemon`
  const authDir = `${WORKSPACE}/auth`
  await ssh.exec(`mkdir -p ${certDir} ${authDir}`)
  await ssh.exec(
    `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 ` +
      `-keyout ${certDir}/server.key -out ${certDir}/server.crt -days 1 -nodes -subj /CN=bespok3d 2>/dev/null`,
  )
  await ssh.putContent(
    `${authDir}/acl.json`,
    JSON.stringify({ keys: [], roles: {}, labels: {}, tokens: [DAEMON_TOKEN], token_identity: {} }),
  )
  const cert = await ssh.getContent(`${certDir}/server.crt`)

  return { cert, token: DAEMON_TOKEN }
}

const DAEMON_PID_FILE = '/tmp/daemon.pid'

// Start the daemon DETACHED via docker exec -d, recording its PID so stopDaemonProcess can kill exactly
// it (the base image has no procps, and a /proc cmdline scan would also match the killer shell). The sh
// backgrounds the daemon, writes $! to the pidfile, then `wait`s on it, so docker exec -d keeps a live
// process and the pidfile holds the real daemon PID.
export function startDaemonProcess(containerId: string): void {
  const command =
    `cd ${DEVICE_DAEMON_DIR} && BESPOK3D_DATA_ROOT=${WORKSPACE} ${DEVICE_VENV}/bin/python daemon.py > /tmp/daemon.log 2>&1 & ` +
    `echo $! > ${DAEMON_PID_FILE}; wait`
  execFileSync('docker', ['exec', '-d', containerId, 'sh', '-c', command])
}

// Clean daemon-down: kill exactly the recorded daemon PID. The mapped 4269 still accepts a TCP connect
// afterwards (docker-proxy), so the HTTP client is what observes the daemon as down, not a port probe.
export function stopDaemonProcess(containerId: string): void {
  const command = `kill -9 "$(cat ${DAEMON_PID_FILE} 2>/dev/null)" 2>/dev/null; true`
  execFileSync('docker', ['exec', containerId, 'sh', '-c', command])
}

export function daemonLog(containerId: string): string {
  try {
    return execFileSync('docker', ['exec', containerId, 'cat', '/tmp/daemon.log'], { encoding: 'utf8' })
  } catch {
    return '(no daemon log)'
  }
}
