// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdmZip from 'adm-zip'
import type { MergedEntry } from '../registry/model'
import type { PrinterRecord } from '../printers'

vi.mock('../registry', () => ({ loadCatalog: vi.fn() }))
vi.mock('./catalog-archive', () => ({ resolveArchiveBytes: vi.fn() }))
vi.mock('./package-check', () => ({ verifiedPackageTrustOrDiscard: vi.fn(async () => 'project') }))
vi.mock('../daemon-client/client', () => ({ fetchFileHashesOrNone: vi.fn(), restoreFiles: vi.fn(async () => []) }))

import { restoreChangedFiles } from './restore-changed-files'
import { loadCatalog } from '../registry'
import { resolveArchiveBytes } from './catalog-archive'
import { verifiedPackageTrustOrDiscard } from './package-check'
import { fetchFileHashesOrNone, restoreFiles } from '../daemon-client/client'

const SIGNED_SHA = 'a'.repeat(64)
const CAMERA_ENTRY = { name: 'example-camera', version: '1.0.0', trust: 'project', signer: null, registry_url: '/registry/index.json', channel: 'stable' } as MergedEntry
const PRINTER = { id: 'printer-1', ip: '203.0.113.7', installedVersions: { 'example-camera': '1.0.0' } } as unknown as PrinterRecord

function cameraPackage(): Buffer {
  const archive = new AdmZip()
  const manifest = { name: 'example-camera', version: '1.0.0', install: {}, files: [{ path: 'files/camera.sh', sha256: SIGNED_SHA }, { path: 'files/camera.cfg', sha256: SIGNED_SHA }] }
  archive.addFile('manifest.json', Buffer.from(JSON.stringify(manifest), 'utf8'))
  archive.addFile('files/camera.sh', Buffer.from('echo camera\n', 'utf8'))
  archive.addFile('files/camera.cfg', Buffer.from('[camera]\n', 'utf8'))

  return archive.toBuffer()
}

function sentMemberNames(): string[] {
  const [, , changedFilesArchive] = vi.mocked(restoreFiles).mock.calls[0]

  return new AdmZip(changedFilesArchive).getEntries().map((member) => member.entryName).sort()
}

describe('a repair that puts back the plugin files that changed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadCatalog).mockResolvedValue({ plugins: [CAMERA_ENTRY] } as never)
    vi.mocked(resolveArchiveBytes).mockResolvedValue(cameraPackage())
  })

  it('sends only the changed files and answers the plugin it repaired', async () => {
    vi.mocked(fetchFileHashesOrNone).mockResolvedValue({ 'files/camera.sh': null, 'files/camera.cfg': SIGNED_SHA })
    expect(await restoreChangedFiles(PRINTER)).toEqual(['example-camera'])
    expect(sentMemberNames()).toEqual(['files/camera.sh'])
  })

  it('sends nothing when every file is still as signed', async () => {
    vi.mocked(fetchFileHashesOrNone).mockResolvedValue({ 'files/camera.sh': SIGNED_SHA, 'files/camera.cfg': SIGNED_SHA })
    expect(await restoreChangedFiles(PRINTER)).toEqual([])
    expect(restoreFiles).not.toHaveBeenCalled()
  })

  it('sends nothing when the printer cannot say what it holds', async () => {
    vi.mocked(fetchFileHashesOrNone).mockResolvedValue(null)
    expect(await restoreChangedFiles(PRINTER)).toEqual([])
    expect(restoreFiles).not.toHaveBeenCalled()
  })

  it('leaves alone a plugin whose installed version the catalog no longer offers', async () => {
    vi.mocked(loadCatalog).mockResolvedValue({ plugins: [{ ...CAMERA_ENTRY, version: '1.1.0' }] } as never)
    expect(await restoreChangedFiles(PRINTER)).toEqual([])
    expect(resolveArchiveBytes).not.toHaveBeenCalled()
  })

  it('never sends a package that does not verify, and goes on', async () => {
    vi.mocked(verifiedPackageTrustOrDiscard).mockRejectedValueOnce(new Error('not signed by a trusted key'))
    expect(await restoreChangedFiles(PRINTER)).toEqual([])
    expect(restoreFiles).not.toHaveBeenCalled()
  })
})
