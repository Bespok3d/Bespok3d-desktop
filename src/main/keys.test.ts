import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('electron', () => ({ app: { getPath: vi.fn() } }))

import { generateKey, listKeys, removeKey, setDefault, setAssignments } from './keys'
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
