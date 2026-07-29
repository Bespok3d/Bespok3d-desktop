// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from 'child_process'
import { readdirSync, statSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { Client } from 'ssh2'
import { createServer } from 'net'
import type { Socket } from 'net'
import { connect, shellQuote } from '../../src/main/ssh'
import type { SshSession } from '../../src/main/ssh'
import { loadFixture } from '../../src/main/testkit/fixture'
import type { ResolvedFixture } from '../../src/main/testkit/fixture'

const DAEMON_PORT = 4269

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

// Seed the daemon venv from the image's baked one into the adapter-declared venv path, so deploy-daemon
// skips the slow on-device PyPI build. Generic: the path comes from the fixture, nothing U1-specific.
export async function seedDaemonVenv(ssh: SshSession, fixture: ResolvedFixture): Promise<void> {
  if (!fixture.daemonVenvDir) return
  await ssh.exec(`mkdir -p ${shellQuote(dirname(fixture.daemonVenvDir))} && cp -a /opt/bespok3d-venv ${shellQuote(fixture.daemonVenvDir)}`)
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

export function daemonSourceDir(): string {
  return resolve(process.cwd(), '../daemon')
}

export function copyDaemonSource(containerId: string): void {
  execFileSync('docker', ['cp', `${daemonSourceDir()}/.`, `${containerId}:/daemon`])
}

// Deploy the adapter's daemon-side half (its jinni) next to the daemon source, so get_jinni() loads
// the real `bespok3d_jinni` instead of the generic fallback. Without this the daemon runs on
// GenericJinni (core paths only); ops that need the device's klipper paths (deactivate/teardown read
// PRINTER_CFG/MOONRAKER_CFG) would KeyError into a 500. It copies the jinni's TOP-LEVEL module files
// (bespok3d_jinni.py + its co-located paths.json + shell templates), skipping the tests/__pycache__
// subdirs - faithful for an adapter whose jinni is flat files (the U1's is); an adapter shipping a
// nested jinni package would need recursion here, matching the client's jinniFiles walk.
export function deployAdapterJinni(containerId: string, adapterId: string): void {
  deployKlipperJinniRuntime(containerId)
  const jinniDir = resolve(process.cwd(), '../adapters', adapterId, 'jinni')
  readdirSync(jinniDir)
    .filter((entry) => statSync(join(jinniDir, entry)).isFile())
    .forEach((file) => execFileSync('docker', ['cp', `${jinniDir}/${file}`, `${containerId}:/daemon/${file}`]))
}

// The other half of the ADR-0037 split: the SHARED klipper jinni runtime, which the adapter's jinni
// imports and which the daemon spawns as `python -m jinni`. Enrollment places it at DAEMON_BASE/jinni
// (adapters/snapmaker-u1/client/jinni-deploy.ts uploadKlipperJinni); here the daemon root is /daemon,
// so it lands at /daemon/jinni and both resolve. Without it daemon startup dies on "No module named
// jinni" and every in-vitro suite fails in prepare().
function deployKlipperJinniRuntime(containerId: string): void {
  const runtimeDir = resolve(process.cwd(), '../adapters/klipper-jinni/jinni')
  execFileSync('docker', ['cp', runtimeDir, `${containerId}:/daemon/jinni`])
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
    `cd /daemon && BESPOK3D_DATA_ROOT=${WORKSPACE} /opt/bespok3d-venv/bin/python daemon.py > /tmp/daemon.log 2>&1 & ` +
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
