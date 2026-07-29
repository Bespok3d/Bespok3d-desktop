// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
// These two DEFINE and re-export the upload, so a mention of it there is not a caller.
const TRANSPORT_FILES = ['daemon-client/packages-client.ts', 'daemon-client/client.ts']
// Word-anchored, so `uninstallPlugin` (which removes files and uploads nothing) is not mistaken for it.
const UPLOAD_CALL = /\binstallPlugin\(/
const CHECK_CALL = /\bverifiedPackageTrustOrDiscard\(/

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFilesUnder(path)

    return entry.name.endsWith('.ts') && !entry.name.includes('.test.') ? [path] : []
  })
}

function modulesUploadingAnArchive(): string[] {
  return sourceFilesUnder(MAIN_DIR)
    .filter((path) => UPLOAD_CALL.test(readFileSync(path, 'utf8')))
    .map((path) => relative(MAIN_DIR, path).replaceAll('\\', '/'))
    .filter((path) => !TRANSPORT_FILES.includes(path))
    .sort()
}

function lineNumbersMatching(source: string, call: RegExp): number[] {
  return source
    .split('\n')
    .map((line, position) => (call.test(line) && !line.startsWith('import') ? position : -1))
    .filter((position) => position >= 0)
}

// A firmware update wipes the printer and the app then re-applies every plugin. What that must never
// become is a silent re-download: bytes the app fetched again are bytes nobody has checked since,
// and an install is the one moment the user is entitled to be told who signed what they are running.
// Bytes already sitting on the printer are a different case and are re-applied as they are.
describe('nothing installs unchecked after a firmware update', () => {
  it('sends an archive to a printer from the store install path and nowhere else', () => {
    expect(modulesUploadingAnArchive()).toEqual(['store/install.ts'])
  })

  it('checks the package before every upload, for the plugin and for its dependencies alike', () => {
    const source = readFileSync(join(MAIN_DIR, 'store/install.ts'), 'utf8')
    const uploads = lineNumbersMatching(source, UPLOAD_CALL)
    const checks = lineNumbersMatching(source, CHECK_CALL)
    expect(uploads).toHaveLength(2)
    expect(checks.length).toBeGreaterThanOrEqual(uploads.length)
    uploads.forEach((upload) => expect(checks.some((check) => check < upload)).toBe(true))
  })

  it('recovers by re-applying what is already on the printer, sending no archive with the request', () => {
    const source = readFileSync(join(MAIN_DIR, 'daemon-client/packages-client.ts'), 'utf8')
    expect(source).toContain("'/packages/recover', undefined")
  })
})
