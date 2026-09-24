// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Minimal `electron` stand-in for the in-vitro suite, which loads real main-process adapter code
// outside Electron. `isPackaged` + `getAppPath()` resolve the adapter's paths.json in the dev layout
// (getAppPath returns the app dir, which is the vitest cwd). `getPath('userData')` backs the REAL
// printers store, so a suite can seed a printer record through savePrinter and let the app's own
// device ops load it with recordOrThrow, instead of hand-building the record the op is meant to read.
// An unknown path name throws rather than defaulting: a wrong directory would be found much later.
const STUB_PATHS: Record<string, string> = {
  userData: mkdtempSync(join(tmpdir(), 'bespok3d-invitro-')),
  temp: tmpdir(),
}

export const app = {
  isPackaged: false,
  getAppPath: (): string => process.cwd(),
  getPath: (name: string): string => {
    const stubbed = STUB_PATHS[name]
    if (!stubbed) throw new Error(`the in-vitro electron stub has no path for "${name}"`)

    return stubbed
  },
}

// The keychain reads this the moment a git-host token is stored. Outside Electron there is no OS
// store to ask, which is exactly what the real safeStorage reports as "not available", so the token
// falls back to the plaintext file the harness seeds.
export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (value: string) => Buffer.from(value, 'utf8'),
  decryptString: (value: Buffer) => value.toString('utf8'),
}

// The device-flow's "open the consent page" step. Outside Electron there is no browser to hand it
// to, and a harness that wants the flow drives the URL itself.
export const shell = {
  openExternal: async (): Promise<void> => {},
}
