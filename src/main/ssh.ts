// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Client, type SFTPWrapper } from 'ssh2'

// Single-quote a value for safe use inside a POSIX shell command (`exec` runs through a shell on the
// device). Use this for ANY path or value interpolated into an `exec` string that is not a fixed
// literal, so a stray quote, space, or `;` cannot break out of the command.
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

export interface SshSession {
  host: string
  exec: (cmd: string) => Promise<string>
  getContent: (remotePath: string) => Promise<string>
  putContent: (remotePath: string, content: string) => Promise<void>
  putBytes: (remotePath: string, data: Buffer) => Promise<void>
  close: () => void
}

export interface SshConnectOptions {
  host: string
  port: number
  user: string
  password: string
}

function openSftp(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((sftpError, sftp) => (sftpError ? reject(sftpError) : resolve(sftp)))
  })
}

function readRemoteFile(sftp: SFTPWrapper, remotePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sftp.readFile(remotePath, 'utf8', (readError, data) =>
      readError ? reject(readError) : resolve(String(data))
    )
  })
}

function writeRemoteFile(sftp: SFTPWrapper, remotePath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, content, { encoding: 'utf8' }, (writeError) =>
      writeError ? reject(writeError) : resolve()
    )
  })
}

function writeRemoteBytes(sftp: SFTPWrapper, remotePath: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, data, (writeError) => writeError ? reject(writeError) : resolve())
  })
}

function runExec(client: Client, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (execError, stream) => {
      var stdout = ''
      var stderr = ''
      if (execError) return reject(execError)
      stream.on('data', (data: Buffer) => { stdout += data.toString() })
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
      stream.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || `Command exited with code ${code}`))
        } else {
          resolve(stdout)
        }
      })
    })
  })
}

// One SFTP channel per connection, opened once and reused for every transfer. Opening a fresh channel
// per file leaked channels (each stays open until the connection ends, so deploying the multi-file
// daemon exhausted the server's MaxSessions) and paid a channel-open + subsystem handshake round-trip
// per file, which dominates the upload time over a slow link. The promise is cached so concurrent
// callers share the one channel; ssh2 multiplexes concurrent requests over it.
function makeSession(client: Client, host: string): SshSession {
  var sftpChannel: Promise<SFTPWrapper> | null = null
  function sharedSftp(): Promise<SFTPWrapper> {
    if (!sftpChannel) sftpChannel = openSftp(client)

    return sftpChannel
  }

  return {
    host,
    exec: (cmd) => runExec(client, cmd),
    getContent: async (remotePath) => readRemoteFile(await sharedSftp(), remotePath),
    putContent: async (remotePath, content) => { await writeRemoteFile(await sharedSftp(), remotePath, content) },
    putBytes: async (remotePath, data) => { await writeRemoteBytes(await sharedSftp(), remotePath, data) },
    close: () => client.end(),
  }
}

export function createPersistentSession(getOpts: () => SshConnectOptions): SshSession {
  const state = { current: null as SshSession | null }

  async function getOrConnect(): Promise<SshSession> {
    if (!state.current) state.current = await connect(getOpts())

    return state.current
  }

  async function attempt<T>(fn: (inner: SshSession) => Promise<T>): Promise<T> {
    try {
      return await fn(await getOrConnect())
    } catch (connectionError) {
      state.current = null
      throw connectionError
    }
  }

  return {
    host: getOpts().host,
    exec: (cmd) => attempt((inner) => inner.exec(cmd)),
    getContent: (path) => attempt((inner) => inner.getContent(path)),
    putContent: (path, content) => attempt((inner) => inner.putContent(path, content)),
    putBytes: (path, data) => attempt((inner) => inner.putBytes(path, data)),
    close: () => { state.current?.close(); state.current = null },
  }
}

export function connect(opts: SshConnectOptions): Promise<SshSession> {
  return new Promise((resolve, reject) => {
    const client = new Client()
    client.on('ready', () => resolve(makeSession(client, opts.host)))
    client.on('error', reject)
    client.connect({
      host: opts.host,
      port: opts.port,
      username: opts.user,
      password: opts.password,
      readyTimeout: 15000,
      hostVerifier: () => true,
      algorithms: {
        serverHostKey: [
          'ssh-rsa',
          'rsa-sha2-256',
          'rsa-sha2-512',
          'ecdsa-sha2-nistp256',
          'ecdsa-sha2-nistp384',
          'ecdsa-sha2-nistp521',
          'ssh-ed25519',
        ],
      },
    })
  })
}
