// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { safeStorage } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'fs'
import { userDataPath } from '../app-paths'

// Decrypted secrets are cached for the process lifetime. Each safeStorage.decryptString is a macOS
// keychain access (a system prompt until the user allows it), and several call sites read the same
// token on startup; without this cache the user is hit with a stack of prompts.
const decryptedCache = new Map<string, string | null>()

function keychainDir(): string {
  const dir = userDataPath('keychain')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  return dir
}

function encryptedPath(key: string): string {
  return join(keychainDir(), `${key}.enc`)
}

function plaintextPath(key: string): string {
  return join(keychainDir(), `${key}.plain`)
}

function removeIfPresent(path: string): void {
  if (existsSync(path)) rmSync(path)
}

export function encryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

// On a host with no OS keyring (headless Linux, a minimal desktop, a VM with no Secret Service)
// safeStorage.encryptString throws "Encryption is not available". There is no OS-backed store to
// fall back to there, so the token is written as plaintext into the same user-owned userData dir it
// would live in either way. Honest degradation beats blocking the user out of the git host entirely.
export function save(key: string, value: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(encryptedPath(key), safeStorage.encryptString(value))
    removeIfPresent(plaintextPath(key))
  } else {
    writeFileSync(plaintextPath(key), Buffer.from(value, 'utf8'))
    removeIfPresent(encryptedPath(key))
  }
  decryptedCache.set(key, value)
}

function readEncrypted(key: string): string | null {
  const path = encryptedPath(key)
  if (!existsSync(path)) return null
  try {
    return safeStorage.decryptString(readFileSync(path))
  } catch {
    rmSync(path)

    return null
  }
}

function readPlaintext(key: string): string | null {
  const path = plaintextPath(key)
  if (!existsSync(path)) return null

  return readFileSync(path, 'utf8')
}

export function load(key: string): string | null {
  if (decryptedCache.has(key)) return decryptedCache.get(key) ?? null
  const value = readEncrypted(key) ?? readPlaintext(key)
  decryptedCache.set(key, value)

  return value
}

export function clear(key: string): void {
  removeIfPresent(encryptedPath(key))
  removeIfPresent(plaintextPath(key))
  decryptedCache.set(key, null)
}
