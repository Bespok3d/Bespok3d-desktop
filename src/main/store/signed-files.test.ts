// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import AdmZip from 'adm-zip'
import { archiveKeeping, filesChangedOnPrinter, filesHeldAsSigned, signedFileHashes } from './signed-files'

const SIGNED_SHA = 'a'.repeat(64)
const OTHER_SHA = 'b'.repeat(64)

const MANIFEST = {
  name: 'example-camera',
  version: '1.0.0',
  install: {},
  files: [
    { path: 'files/camera.sh', sha256: SIGNED_SHA },
    { path: 'files/camera.cfg', sha256: OTHER_SHA },
    { path: 'files/unhashed.txt' },
  ],
}

function examplePackage(): Buffer {
  const archive = new AdmZip()
  archive.addFile('manifest.json', Buffer.from(JSON.stringify(MANIFEST), 'utf8'))
  archive.addFile('manifest.json.sig', Buffer.from('obviously fake signature', 'utf8'))
  archive.addFile('files/camera.sh', Buffer.from('echo camera\n', 'utf8'))
  archive.addFile('files/camera.cfg', Buffer.from('[camera]\n', 'utf8'))
  archive.addFile('files/unhashed.txt', Buffer.from('no hash\n', 'utf8'))

  return archive.toBuffer()
}

const SIGNED = signedFileHashes(examplePackage(), 'example-camera')

describe('the signed file list of a package', () => {
  it('holds every listed file that carries a hash, and only those', () => {
    expect([...SIGNED.entries()]).toEqual([['files/camera.sh', SIGNED_SHA], ['files/camera.cfg', OTHER_SHA]])
  })
})

describe('the files a printer holds as signed', () => {
  it('are the ones whose printer hash equals the signed hash', () => {
    const held = filesHeldAsSigned(SIGNED, { 'files/camera.sh': SIGNED_SHA, 'files/camera.cfg': SIGNED_SHA })
    expect([...held]).toEqual(['files/camera.sh'])
  })

  it('never include a file the printer does not have', () => {
    expect([...filesHeldAsSigned(SIGNED, { 'files/camera.sh': null })]).toEqual([])
  })

  it('never include a file the package does not sign', () => {
    expect([...filesHeldAsSigned(SIGNED, { 'files/unhashed.txt': SIGNED_SHA })]).toEqual([])
  })
})

describe('the files that changed on a printer', () => {
  it('are the signed ones whose printer copy differs or is missing', () => {
    const changed = filesChangedOnPrinter(SIGNED, { 'files/camera.sh': null, 'files/camera.cfg': SIGNED_SHA })
    expect([...changed]).toEqual(['files/camera.sh', 'files/camera.cfg'])
  })

  it('leave out a file still as signed and a file the package does not sign', () => {
    const changed = filesChangedOnPrinter(SIGNED, { 'files/camera.sh': SIGNED_SHA, 'files/unhashed.txt': OTHER_SHA })
    expect([...changed]).toEqual([])
  })
})

describe('a package cut down to some of its members', () => {
  it('keeps the kept members byte for byte and drops the rest', () => {
    const original = new AdmZip(examplePackage())
    const kept = new AdmZip(archiveKeeping(examplePackage(), 'example-camera', (memberName) => memberName !== 'files/camera.sh'))
    const keptNames = kept.getEntries().map((member) => member.entryName).sort()
    expect(keptNames).toEqual(['files/camera.cfg', 'files/unhashed.txt', 'manifest.json', 'manifest.json.sig'])
    expect(kept.getEntry('manifest.json')?.getData()).toEqual(original.getEntry('manifest.json')?.getData())
    expect(kept.getEntry('manifest.json.sig')?.getData()).toEqual(original.getEntry('manifest.json.sig')?.getData())
  })
})
