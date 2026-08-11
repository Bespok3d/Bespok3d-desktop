// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A list read off local disk is a list like any other. Coming off the filesystem is not a reason to
// believe it: the bundled copy and the B3D_DEV_SOURCES override both land here, so if this path
// skipped the signature the app would trust whatever a dev root happened to contain.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { fetchDiskRegistry } from './disk-transport'
import type { RegistryRef } from '../model'

const INDEX_BYTES = JSON.stringify({ plugins: [{ name: 'bespok3d-daemon', version: '0.12.24' }] })
const NOT_A_SIGNATURE = '-----BEGIN PGP SIGNATURE-----\nnothing that stands up\n-----END PGP SIGNATURE-----\n'

function diskRef(indexPath: string): RegistryRef {
  return { url: indexPath, trust: 'project', locked: true }
}

describe('a registry read off local disk', () => {
  var root: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'b3d-disk-registry-'))
    writeFileSync(join(root, 'signed.json'), INDEX_BYTES)
    writeFileSync(join(root, 'signed.json.sig'), NOT_A_SIGNATURE)
    writeFileSync(join(root, 'bare.json'), INDEX_BYTES)
  })

  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('reads the detached signature sitting beside the index and puts it through the same check a served list gets', async () => {
    const fetched = await fetchDiskRegistry(diskRef(join(root, 'signed.json')))

    expect(fetched.signature.proof).toBe('failed')
  })

  it('reports a local index with no signature beside it as unsigned, never as trusted for being local', async () => {
    const fetched = await fetchDiskRegistry(diskRef(join(root, 'bare.json')))

    expect(fetched.signature.proof).toBe('unsigned')
  })

  it('still loads the list either way, so a signing mistake in a dev root costs a badge and not a dead store', async () => {
    const fetched = await fetchDiskRegistry(diskRef(join(root, 'bare.json')))

    expect(fetched.index.plugins?.[0]?.name).toBe('bespok3d-daemon')
  })
})
