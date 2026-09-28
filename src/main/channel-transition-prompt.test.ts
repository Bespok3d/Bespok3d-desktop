// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const transitionHarness = vi.hoisted(() => ({
  appDataDirectory: '',
  choices: [] as { response: number }[],
  processList: '',
  showMessageBox: vi.fn(async function () {
    return transitionHarness.choices.shift() ?? { response: 0 }
  }),
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => transitionHarness.appDataDirectory,
    getLocale: () => 'en',
  },
  dialog: { showMessageBox: transitionHarness.showMessageBox },
  safeStorage: {
    isEncryptionAvailable: () => true,
    decryptString: (encryptedValue: Buffer) => {
      if (encryptedValue.toString('utf8').startsWith('not-readable:')) throw new Error('Unreadable test ciphertext')

      return 'verified-test-value'
    },
  },
}))
vi.mock('child_process', () => ({ execFileSync: () => transitionHarness.processList }))

import { prepareBetaProfileTransition } from './channel-transition-prompt'

const testRoot = mkdtempSync(join(tmpdir(), 'b3d-transition-prompt-'))
const betaProfile = join(testRoot, 'Bespok3d Beta')
const stagingProfile = join(testRoot, 'Bespok3d Staging')

function writeBetaSettings(contents = '{"theme":"dark"}'): void {
  writeFileSync(join(betaProfile, 'settings.json'), contents)
}

beforeEach(() => {
  transitionHarness.appDataDirectory = testRoot
  transitionHarness.choices = []
  transitionHarness.processList = ''
  transitionHarness.showMessageBox.mockClear()
  mkdirSync(betaProfile, { recursive: true })
  mkdirSync(stagingProfile, { recursive: true })
})

afterEach(() => {
  rmSync(betaProfile, { recursive: true, force: true })
  rmSync(stagingProfile, { recursive: true, force: true })
  rmSync(`${stagingProfile}.beta-profile-copy`, { recursive: true, force: true })
})

afterAll(() => rmSync(testRoot, { recursive: true, force: true }))

describe('the owner-chosen Beta transition prompt', () => {
  it('leaves Beta unchanged when the owner cancels', async () => {
    writeBetaSettings()
    transitionHarness.choices = [{ response: 2 }]

    expect(await prepareBetaProfileTransition('Bespok3d Beta', stagingProfile)).toBe(false)
    expect(existsSync(join(stagingProfile, 'settings.json'))).toBe(false)
    expect(readFileSync(join(betaProfile, 'settings.json'), 'utf8')).toBe('{"theme":"dark"}')
  })

  it('keeps a fresh Staging install separate when the owner declines Beta data', async () => {
    writeBetaSettings()
    transitionHarness.choices = [{ response: 1 }]

    expect(await prepareBetaProfileTransition('Bespok3d Beta', stagingProfile)).toBe(true)
    expect(existsSync(join(stagingProfile, 'settings.json'))).toBe(false)
    expect(existsSync(join(betaProfile, 'settings.json'))).toBe(true)
  })

  it('copies only after the owner chooses Beta data and confirms Beta is closed', async () => {
    writeBetaSettings()
    transitionHarness.choices = [{ response: 0 }]

    expect(await prepareBetaProfileTransition('Bespok3d Beta', stagingProfile)).toBe(true)
    expect(readFileSync(join(stagingProfile, 'settings.json'), 'utf8')).toBe('{"theme":"dark"}')
    expect(readFileSync(join(betaProfile, 'settings.json'), 'utf8')).toBe('{"theme":"dark"}')
  })
})

describe('Beta transition safety prompts', () => {
  it('asks the owner to close a running Beta client and does not snapshot it', async () => {
    writeBetaSettings()
    transitionHarness.processList = 'Bespok3d Beta\n'
    transitionHarness.choices = [{ response: 0 }, { response: 0 }]

    expect(await prepareBetaProfileTransition('Bespok3d Beta', stagingProfile)).toBe(false)
    expect(transitionHarness.showMessageBox).toHaveBeenCalledTimes(2)
    expect(existsSync(join(stagingProfile, 'settings.json'))).toBe(false)
  })

  it('offers a fresh Staging launch after encrypted Beta state fails verification', async () => {
    writeBetaSettings()
    mkdirSync(join(betaProfile, 'keychain'), { recursive: true })
    writeFileSync(join(betaProfile, 'keychain/github-token.enc'), 'not-readable:test-ciphertext')
    transitionHarness.choices = [{ response: 0 }, { response: 0 }]

    expect(await prepareBetaProfileTransition('Bespok3d Beta', stagingProfile)).toBe(true)
    expect(existsSync(join(stagingProfile, 'settings.json'))).toBe(false)
    expect(existsSync(join(betaProfile, 'settings.json'))).toBe(true)
  })

  it('does not overwrite existing Staging state when Beta also exists', async () => {
    writeBetaSettings()
    writeFileSync(join(stagingProfile, 'settings.json'), '{"theme":"light"}')
    transitionHarness.choices = [{ response: 0 }]

    expect(await prepareBetaProfileTransition('Bespok3d Beta', stagingProfile)).toBe(true)
    expect(readFileSync(join(stagingProfile, 'settings.json'), 'utf8')).toBe('{"theme":"light"}')
    expect(transitionHarness.showMessageBox).toHaveBeenCalledTimes(1)
  })
})
