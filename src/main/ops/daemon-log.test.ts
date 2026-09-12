// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'

vi.mock('../printers', () => ({ checkDaemon: vi.fn() }))

import { formatDaemonStartFailure, waitForDaemon } from './daemon-log'
import { checkDaemon } from '../printers'

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
