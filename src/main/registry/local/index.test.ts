// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AdmZip from 'adm-zip'

const userDataDir = mkdtempSync(join(tmpdir(), 'b3-local-'))
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }))

import { addLocalPackages, removeLocalPackage, readLocalDoc, userLocalIndexExists, userLocalDir } from './index'
import { CPU_TEMP_MANIFEST as FULL } from './manifest-fixture'

function makeB3(manifest: Record<string, unknown>, withDoc: boolean): string {
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
  zip.addFile('files/cfg/klipper/cpu-temp.cfg', Buffer.from('[temperature_sensor Rockchip]\n'))
  if (withDoc) zip.addFile('doc/README.md', Buffer.from(`# ${manifest.name as string}\n`))
  const out = join(userDataDir, `drop-${manifest.name}-${manifest.version}.b3`)
  zip.writeZip(out)

  return out
}

beforeEach(() => {
  if (existsSync(userLocalDir())) rmSync(userLocalDir(), { recursive: true, force: true })
})

describe('addLocalPackages / removeLocalPackage (filesystem)', () => {
  it('ingests a dropped .b3, indexes it, and stages its doc', () => {
    const result = addLocalPackages([makeB3(FULL, true)])
    expect(result.errors).toEqual([])
    expect(result.added[0]).toMatchObject({ id: 'cpu-temp', version: '0.1.2', metadataComplete: true })
    expect(userLocalIndexExists()).toBe(true)
    expect(existsSync(join(userLocalDir(), 'cpu-temp-0.1.2.b3'))).toBe(true)
    expect(readLocalDoc('cpu-temp', 'README.md')).toContain('# cpu-temp')
  })

  it('replaces the prior local copy when a new version of the same id is dropped', () => {
    addLocalPackages([makeB3(FULL, false)])
    addLocalPackages([makeB3({ ...FULL, version: '0.2.0' }, false)])
    const b3s = readdirSync(userLocalDir()).filter((name) => name.startsWith('cpu-temp-') && name.endsWith('.b3'))
    expect(b3s).toEqual(['cpu-temp-0.2.0.b3'])
  })

  it('reports a clear error for a corrupt file without aborting the batch', () => {
    const ok = makeB3(FULL, false)
    const bad = join(userDataDir, 'broken.b3')
    writeFileSync(bad, Buffer.from('not a zip'))
    const result = addLocalPackages([bad, ok])
    expect(result.added).toHaveLength(1)
    expect(result.errors[0].message).toContain("isn't a valid .b3")
  })

  it('removes a local package and drops the store when it was the last one', () => {
    addLocalPackages([makeB3(FULL, false)])
    removeLocalPackage('cpu-temp')
    expect(userLocalIndexExists()).toBe(false)
  })
})
