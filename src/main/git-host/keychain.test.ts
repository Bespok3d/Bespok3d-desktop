// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const userDataDir = mkdtempSync(join(tmpdir(), 'b3-keychain-'))

const encryptionState = { available: true }

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => encryptionState.available,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (buffer: Buffer) => buffer.toString('utf8').replace(/^enc:/, '')
  }
}))

import { save, load, clear } from './keychain'

function encFile(key: string): string {
  return join(userDataDir, 'keychain', `${key}.enc`)
}

function plainFile(key: string): string {
  return join(userDataDir, 'keychain', `${key}.plain`)
}

describe('keychain', () => {
  it('round-trips a secret through the OS keyring when encryption is available', () => {
    encryptionState.available = true
    save('github-token', 'ghp_secret')
    expect(existsSync(encFile('github-token'))).toBe(true)
    expect(existsSync(plainFile('github-token'))).toBe(false)
    expect(load('github-token')).toBe('ghp_secret')
  })

  it('falls back to plaintext when no keyring is available instead of throwing', () => {
    encryptionState.available = false
    expect(() => save('gitea-token', 'pat_secret')).not.toThrow()
    expect(existsSync(plainFile('gitea-token'))).toBe(true)
    expect(existsSync(encFile('gitea-token'))).toBe(false)
    expect(load('gitea-token')).toBe('pat_secret')
  })

  it('clears both representations', () => {
    encryptionState.available = true
    save('to-clear', 'value')
    clear('to-clear')
    expect(existsSync(encFile('to-clear'))).toBe(false)
    expect(existsSync(plainFile('to-clear'))).toBe(false)
    expect(load('to-clear')).toBe(null)
  })
})
