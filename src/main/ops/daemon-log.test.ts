import { describe, it, expect, vi } from 'vitest'

vi.mock('../printers', () => ({ checkDaemon: vi.fn() }))
vi.mock('../ssh', () => ({ shellQuote: (value: string) => `'${value}'` }))

import { formatDaemonStartFailure, tailDaemonLog, waitForDaemon } from './daemon-log'
import { checkDaemon } from '../printers'
import type { SshSession } from '../ssh'

describe('formatDaemonStartFailure', () => {
  it('returns the bare message when the log tail is empty', () => {
    expect(formatDaemonStartFailure('')).toBe('Daemon did not start within the expected time')
  })

  it('returns the bare message when the log tail is whitespace only', () => {
    expect(formatDaemonStartFailure('   \n\t  ')).toBe('Daemon did not start within the expected time')
  })

  it('appends the trimmed tail under a labelled separator when content is present', () => {
    const tailContent = 'Traceback (most recent call last):\nFile "daemon.py"\nImportError: missing module'
    const formatted = formatDaemonStartFailure(`\n${tailContent}\n\n`)
    expect(formatted).toContain('Daemon did not start within the expected time')
    expect(formatted).toContain('--- daemon.log (last 200 lines) ---')
    expect(formatted).toContain('ImportError: missing module')
    expect(formatted).not.toMatch(/---\n\n/)
  })
})

describe('tailDaemonLog', () => {
  it('asks for the last 200 lines of the standard daemon log path', async () => {
    const execMock = vi.fn().mockResolvedValue('log lines')
    const fakeSession = { exec: execMock } as unknown as SshSession
    const result = await tailDaemonLog(fakeSession)
    expect(execMock).toHaveBeenCalledTimes(1)
    const commandIssued = execMock.mock.calls[0][0] as string
    expect(commandIssued).toContain('tail -200')
    expect(commandIssued).toContain('/userdata/bespok3d/var/log/daemon.log')
    expect(commandIssued).toContain('|| true')
    expect(result).toBe('log lines')
  })

  it('respects a custom log path when supplied', async () => {
    const execMock = vi.fn().mockResolvedValue('')
    const fakeSession = { exec: execMock } as unknown as SshSession
    await tailDaemonLog(fakeSession, '/somewhere/else/daemon.log')
    expect(execMock.mock.calls[0][0]).toContain('/somewhere/else/daemon.log')
  })
})

describe('waitForDaemon', () => {
  it('resolves as soon as the daemon answers', async () => {
    vi.mocked(checkDaemon).mockResolvedValue(true)
    await expect(waitForDaemon('10.0.0.5', undefined, 1)).resolves.toBeUndefined()
  })

  it('throws with the captured log tail when the daemon never answers', async () => {
    vi.mocked(checkDaemon).mockResolvedValue(false)
    await expect(waitForDaemon('10.0.0.5', async () => 'ImportError: boom', 1)).rejects.toThrow(/ImportError: boom/)
  })
})
