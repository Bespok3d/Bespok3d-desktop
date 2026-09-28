// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('electron', () => ({ app: { getPath: vi.fn() } }))

import { generateKey, listKeys, removeKey, setDefault, setAssignments, localProfilesWithKey, importKeyFromProfile, exportPrivateKey, hasMatchingPrivateKey } from './keys'
import { app } from 'electron'

const mockGetPath = vi.mocked(app.getPath)

describe('key store: corrupt file resilience', () => {
  var testDir: string
  beforeEach(() => { testDir = mkdtempSync(join(tmpdir(), 'b3-keys-')); mockGetPath.mockReturnValue(testDir) })
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }) })

  it('skips a corrupt key meta file and still lists the valid keys', () => {
    mkdirSync(join(testDir, 'keys'), { recursive: true })
    writeFileSync(join(testDir, 'keys', 'good.meta.json'), JSON.stringify({ id: 'good', label: 'Good' }))
    writeFileSync(join(testDir, 'keys', 'broken.meta.json'), '{ not valid json')

    expect(listKeys().map((key) => key.id)).toEqual(['good'])
  })
})

describe('generateKey', () => {
  var testDir: string
  beforeEach(() => { testDir = mkdtempSync(join(tmpdir(), 'b3-keys-')); mockGetPath.mockReturnValue(testDir) })
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }) })

  it('produces a key record with all required fields', async () => {
    const record = await generateKey({ label: 'Test Key' })
    expect(record.label).toBe('Test Key')
    expect(record.fingerprint).toBeTruthy()
    expect(record.publicKey).toContain('BEGIN PGP PUBLIC KEY BLOCK')
    expect(record.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('sets the first key as the default', async () => {
    const record = await generateKey({ label: 'First' })
    expect(record.isDefault).toBe(true)
  })

  it('does not set subsequent keys as the default', async () => {
    await generateKey({ label: 'First' })
    const second = await generateKey({ label: 'Second' })
    expect(second.isDefault).toBe(false)
  })

  it('persists the key so listKeys finds it after generation', async () => {
    const record = await generateKey({ label: 'Persisted' })
    expect(listKeys().some((key) => key.id === record.id)).toBe(true)
  })
})

describe('listKeys', () => {
  var testDir: string
  beforeEach(() => { testDir = mkdtempSync(join(tmpdir(), 'b3-keys-')); mockGetPath.mockReturnValue(testDir) })
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }) })

  it('returns an empty array when no keys exist', () => {
    expect(listKeys()).toEqual([])
  })

  it('promotes the first key to default when none is marked default', async () => {
    const record = await generateKey({ label: 'Only Key' })
    expect(listKeys().find((key) => key.id === record.id)?.isDefault).toBe(true)
  })
})

describe('removeKey', () => {
  var testDir: string
  beforeEach(() => { testDir = mkdtempSync(join(tmpdir(), 'b3-keys-')); mockGetPath.mockReturnValue(testDir) })
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }) })

  it('removes the key so it no longer appears in listKeys', async () => {
    const record = await generateKey({ label: 'To Remove' })
    removeKey(record.id)
    expect(listKeys().some((key) => key.id === record.id)).toBe(false)
  })

  it('promotes the next key to default when the default key is deleted', async () => {
    const firstKey = await generateKey({ label: 'First' })
    const secondKey = await generateKey({ label: 'Second' })
    removeKey(firstKey.id)
    expect(listKeys().find((key) => key.id === secondKey.id)?.isDefault).toBe(true)
  })
})

describe('setDefault', () => {
  var testDir: string
  beforeEach(() => { testDir = mkdtempSync(join(tmpdir(), 'b3-keys-')); mockGetPath.mockReturnValue(testDir) })
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }) })

  it('marks the specified key as default and clears the others', async () => {
    const firstKey = await generateKey({ label: 'First' })
    const secondKey = await generateKey({ label: 'Second' })
    setDefault(secondKey.id)
    const updated = listKeys()
    expect(updated.find((key) => key.id === secondKey.id)?.isDefault).toBe(true)
    expect(updated.find((key) => key.id === firstKey.id)?.isDefault).toBe(false)
  })
})

describe('setAssignments: exclusive per {purpose, entityId}', () => {
  var testDir: string
  beforeEach(() => { testDir = mkdtempSync(join(tmpdir(), 'b3-keys-')); mockGetPath.mockReturnValue(testDir) })
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }) })

  it('removes a conflicting assignment from another key when reassigned', async () => {
    const keyA = await generateKey({ label: 'A' })
    const keyB = await generateKey({ label: 'B' })
    setAssignments(keyA.id, [{ purpose: 'packages', entityId: 'my-repo' }])
    setAssignments(keyB.id, [{ purpose: 'packages', entityId: 'my-repo' }])
    const updated = listKeys()
    expect(updated.find((key) => key.id === keyA.id)?.assignments).toHaveLength(0)
    expect(updated.find((key) => key.id === keyB.id)?.assignments).toEqual([{ purpose: 'packages', entityId: 'my-repo' }])
  })
})

describe('local Bespok3d key import', () => {
  var testDir: string
  var activeProfile: string
  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'b3-key-profiles-'))
    activeProfile = 'Bespok3d'
    mockGetPath.mockImplementation((name) => name === 'appData' ? testDir : join(testDir, activeProfile))
  })
  afterEach(() => rmSync(testDir, { recursive: true, force: true }))

  it('finds and copies the same private key into Staging without copying settings or assignments', async () => {
    const original = await generateKey({ label: 'Publisher' })
    setAssignments(original.id, [{ purpose: 'packages', entityId: 'sample-repo' }])
    const privateKey = exportPrivateKey(original.id)
    activeProfile = 'Bespok3d Staging'

    expect(await localProfilesWithKey(original.fingerprint)).toEqual(['Bespok3d'])
    const imported = await importKeyFromProfile(original.fingerprint, 'Bespok3d', original.publicKey)

    expect(imported.fingerprint).toBe(original.fingerprint)
    expect(imported.assignments).toEqual([])
    expect(exportPrivateKey(original.id)).toBe(privateKey)
    expect(listKeys()).toHaveLength(1)
    await expect(importKeyFromProfile(original.fingerprint, 'Bespok3d', original.publicKey)).rejects.toThrow('already has')
  })

  it('refuses a private key that differs from the published public key', async () => {
    const source = await generateKey({ label: 'Source' })
    const other = await generateKey({ label: 'Other' })
    activeProfile = 'Bespok3d Staging'

    await expect(importKeyFromProfile(source.fingerprint, 'Bespok3d', other.publicKey)).rejects.toThrow('does not match')
    expect(listKeys()).toEqual([])
  })

  it('does not call a mismatched private file a usable match', async () => {
    const source = await generateKey({ label: 'Source' })
    const other = await generateKey({ label: 'Other' })
    writeFileSync(join(testDir, 'Bespok3d', 'keys', `${source.id}.priv.asc`), exportPrivateKey(other.id))

    expect(await hasMatchingPrivateKey(source.id)).toBe(false)
    activeProfile = 'Bespok3d Staging'
    expect(await localProfilesWithKey(source.id)).toEqual([])
  })
})
