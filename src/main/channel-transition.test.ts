// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  betaTransitionState,
  migrateBetaProfile,
  processListHasBetaClient,
  recoverInterruptedBetaTransition,
} from './channel-transition'
import type { SafeStorageReader } from './channel-transition'

const testRoot = mkdtempSync(join(tmpdir(), 'b3d-channel-transition-'))
const safeStorage: SafeStorageReader = {
  isEncryptionAvailable: () => true,
  decryptString: (encryptedValue) => {
    if (encryptedValue.toString('utf8').startsWith('not-readable:')) throw new Error('Unreadable test ciphertext')

    return 'verified-test-value'
  },
}
const profilePaths = {
  beta: join(testRoot, 'Bespok3d Beta'),
  staging: join(testRoot, 'Bespok3d Staging'),
  live: join(testRoot, 'Bespok3d'),
  development: join(testRoot, 'Bespok3d Dev'),
}

function writeBetaState(relativePath: string, contents: string): void {
  const betaFile = join(profilePaths.beta, relativePath)
  mkdirSync(join(betaFile, '..'), { recursive: true })
  writeFileSync(betaFile, contents)
}

function writePrinterRecord(): string {
  const printerRecord = JSON.stringify({
    id: 'printer-test-01',
    installedIds: ['sample-plugin'],
    installedSources: { 'sample-plugin': 'github:example-owner/example-list' },
    installedChannels: { 'sample-plugin': 'rc' },
    installedPackageTrust: { 'sample-plugin': 'project' },
    daemonToken: 'obviously-fake-daemon-token',
    daemonCert: 'obviously-fake-daemon-certificate',
    accessIdentity: 'obviously-fake-access-identity',
  })
  writeBetaState('printers/printer-test-01.json', printerRecord)

  return printerRecord
}

beforeEach(() => {
  mkdirSync(profilePaths.beta, { recursive: true })
  mkdirSync(profilePaths.staging, { recursive: true })
  mkdirSync(profilePaths.live, { recursive: true })
  mkdirSync(profilePaths.development, { recursive: true })
})

afterEach(() => {
  rmSync(profilePaths.beta, { recursive: true, force: true })
  rmSync(profilePaths.staging, { recursive: true, force: true })
  rmSync(profilePaths.live, { recursive: true, force: true })
  rmSync(profilePaths.development, { recursive: true, force: true })
  rmSync(`${profilePaths.staging}.beta-profile-copy`, { recursive: true, force: true })
})

afterAll(() => rmSync(testRoot, { recursive: true, force: true }))

describe('Beta-to-Staging profile copy', () => {
  it('leaves a fresh Staging profile fresh when Beta has no app state', () => {
    mkdirSync(join(profilePaths.beta, 'Default'), { recursive: true })

    expect(betaTransitionState(profilePaths.beta, profilePaths.staging)).toBe('absent')
    expect(migrateBetaProfile(profilePaths.beta, profilePaths.staging, safeStorage, false)).toBe('missing-beta')
    expect(existsSync(join(profilePaths.staging, 'settings.json'))).toBe(false)
  })

  it('copies Beta settings, printer identity, installed provenance and access while retaining Beta', () => {
    const settings = '{"theme":"dark","clientId":"client-beta"}'
    const printerRecord = writePrinterRecord()
    writeBetaState('settings.json', settings)
    writeBetaState('keychain/github-token.enc', 'readable:fake-ciphertext')
    writeBetaState('Cookies', 'browser-only Beta data')
    writeFileSync(join(profilePaths.live, 'live-only.enc'), 'must-not-be-read')
    writeFileSync(join(profilePaths.development, 'dev-only.enc'), 'must-not-be-read')

    expect(betaTransitionState(profilePaths.beta, profilePaths.staging)).toBe('needs-choice')
    expect(migrateBetaProfile(profilePaths.beta, profilePaths.staging, safeStorage, false)).toBe('copied')
    expect(readFileSync(join(profilePaths.staging, 'settings.json'), 'utf8')).toBe(settings)
    expect(readFileSync(join(profilePaths.staging, 'printers/printer-test-01.json'), 'utf8')).toBe(printerRecord)
    expect(readFileSync(join(profilePaths.staging, 'keychain/github-token.enc'), 'utf8')).toBe('readable:fake-ciphertext')
    expect(readFileSync(join(profilePaths.beta, 'settings.json'), 'utf8')).toBe(settings)
    expect(readFileSync(join(profilePaths.beta, 'printers/printer-test-01.json'), 'utf8')).toBe(printerRecord)
    expect(existsSync(join(profilePaths.staging, 'Cookies'))).toBe(false)
    expect(readFileSync(join(profilePaths.live, 'live-only.enc'), 'utf8')).toBe('must-not-be-read')
    expect(readFileSync(join(profilePaths.development, 'dev-only.enc'), 'utf8')).toBe('must-not-be-read')
  })

  it('refuses to merge into existing Staging app data', () => {
    writeBetaState('settings.json', '{"theme":"dark"}')
    writeFileSync(join(profilePaths.staging, 'settings.json'), '{"theme":"light"}')
    mkdirSync(`${profilePaths.staging}.beta-profile-copy`, { recursive: true })
    writeFileSync(join(`${profilePaths.staging}.beta-profile-copy`, 'settings.json'), '{"theme":"dark"}')

    expect(migrateBetaProfile(profilePaths.beta, profilePaths.staging, safeStorage, false)).toBe('staging-conflict')
    expect(readFileSync(join(profilePaths.staging, 'settings.json'), 'utf8')).toBe('{"theme":"light"}')
    expect(recoverInterruptedBetaTransition(profilePaths.staging)).toBe(true)
    expect(readFileSync(join(profilePaths.staging, 'settings.json'), 'utf8')).toBe('{"theme":"light"}')
    expect(existsSync(`${profilePaths.staging}.beta-profile-copy`)).toBe(false)
    expect(readFileSync(join(profilePaths.beta, 'settings.json'), 'utf8')).toBe('{"theme":"dark"}')
  })
})

describe('Beta-to-Staging profile recovery', () => {
  it('does not snapshot a running Beta profile', () => {
    writeBetaState('settings.json', '{"theme":"dark"}')

    expect(processListHasBetaClient('Electron Helper\nBespok3d Beta\n')).toBe(true)
    expect(processListHasBetaClient('"Bespok3d Beta.exe","4120","Console"\n')).toBe(true)
    expect(processListHasBetaClient('Bespok3d Beta-like utility\n')).toBe(false)
    expect(migrateBetaProfile(profilePaths.beta, profilePaths.staging, safeStorage, true)).toBe('beta-running')
    expect(existsSync(join(profilePaths.staging, 'settings.json'))).toBe(false)
  })

  it('recovers an interrupted copy before retrying from the unchanged Beta source', () => {
    const settings = '{"theme":"dark"}'
    writeBetaState('settings.json', settings)
    writeFileSync(join(profilePaths.staging, '.bespok3d-beta-transition-incomplete'), 'copy in progress')
    writeFileSync(join(profilePaths.staging, 'settings.json'), 'partial copy')

    expect(betaTransitionState(profilePaths.beta, profilePaths.staging)).toBe('interrupted')
    expect(recoverInterruptedBetaTransition(profilePaths.staging)).toBe(true)
    expect(migrateBetaProfile(profilePaths.beta, profilePaths.staging, safeStorage, false)).toBe('copied')
    expect(readFileSync(join(profilePaths.staging, 'settings.json'), 'utf8')).toBe(settings)
    expect(readFileSync(join(profilePaths.beta, 'settings.json'), 'utf8')).toBe(settings)
  })

  it('retains Beta and leaves no Staging copy when encrypted state cannot be read', () => {
    const encrypted = 'not-readable:fake-ciphertext'
    writeBetaState('settings.json', '{"theme":"dark"}')
    writeBetaState('keychain/github-token.enc', encrypted)

    expect(migrateBetaProfile(profilePaths.beta, profilePaths.staging, safeStorage, false)).toBe('unreadable-encrypted-state')
    expect(readFileSync(join(profilePaths.beta, 'keychain/github-token.enc'), 'utf8')).toBe(encrypted)
    expect(existsSync(join(profilePaths.staging, 'settings.json'))).toBe(false)
    expect(existsSync(`${profilePaths.staging}.beta-profile-copy`)).toBe(false)
  })

  it('treats a repeated transition as complete without replacing later Staging edits', () => {
    writeBetaState('settings.json', '{"theme":"dark"}')
    expect(migrateBetaProfile(profilePaths.beta, profilePaths.staging, safeStorage, false)).toBe('copied')
    writeFileSync(join(profilePaths.staging, 'settings.json'), '{"theme":"light"}')
    writeFileSync(join(profilePaths.beta, 'settings.json'), '{"theme":"system"}')

    expect(migrateBetaProfile(profilePaths.beta, profilePaths.staging, safeStorage, false)).toBe('complete')
    expect(readFileSync(join(profilePaths.staging, 'settings.json'), 'utf8')).toBe('{"theme":"light"}')
  })
})
