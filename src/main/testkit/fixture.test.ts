// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { resolve } from 'path'
import { loadFixture } from './fixture'

// cwd is the app dir when vitest runs (npm --prefix), matching the @adapters alias convention.
const U1_ADAPTER_DIR = resolve(process.cwd(), '../adapters/snapmaker-u1')

describe('loadFixture (adapter test contract)', () => {
  it('resolves path placeholders against the adapter paths.json', () => {
    const fixture = loadFixture(U1_ADAPTER_DIR)
    expect(fixture.postEnroll.dirs).toContain('/userdata/bespok3d/bin')
    expect(fixture.postEnroll.files).toContain('/userdata/bespok3d/auth/acl.json')
  })

  it('keeps placeholder-free skeleton paths and carries ssh + file content verbatim', () => {
    const fixture = loadFixture(U1_ADAPTER_DIR)
    expect(fixture.skeleton.dirs).toContain('/home/lava/klipper/klippy/extras')
    expect(fixture.ssh.port).toBe(2222)
    expect(fixture.skeleton.files).toContainEqual({ path: '/etc/FULLVERSION', content: '1.4.1.6_20260608141446' })
  })

  it('leaves no unresolved placeholders in any resolved path', () => {
    const fixture = loadFixture(U1_ADAPTER_DIR)
    const allPaths = [...fixture.postEnroll.dirs, ...fixture.postEnroll.files, ...fixture.skeleton.dirs]
    allPaths.forEach((path) => expect(path).not.toContain('$'))
  })
})
