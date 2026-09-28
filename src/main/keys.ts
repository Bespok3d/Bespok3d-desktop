// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, lstatSync } from 'fs'
import { app } from 'electron'
import * as openpgp from 'openpgp'
import { readJsonFile } from './json-store'
import { userDataPath } from './app-paths'
import type { KeyPurpose, KeyAssignment, GenerateKeyOptions, KeyRecord } from '@bespok3d/contract'

function keysDir(): string {
  const dir = userDataPath('keys')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  return dir
}

function metaPath(id: string): string {
  return join(keysDir(), `${id}.meta.json`)
}
function privPath(id: string): string {
  return join(keysDir(), `${id}.priv.asc`)
}

const LEGACY_PURPOSE_MAP: Record<string, KeyPurpose[]> = {
  identity: ['printers'],
  package: ['packages'],
  list: ['lists'],
}

type RawRecord = Partial<KeyRecord> & {
  purpose?: string
  purposes?: KeyPurpose[]
}

function migrateRecord(raw: RawRecord): KeyRecord {
  var assignments: KeyAssignment[] = []
  const isDefault = raw.isDefault ?? false

  if (Array.isArray(raw.assignments)) {
    assignments = raw.assignments
  } else if (!raw.purposes && raw.purpose) {
    // Very old format: single purpose string; drop entity info, user re-assigns
    LEGACY_PURPOSE_MAP[raw.purpose]?.forEach((purpose) => {
      assignments.push({ purpose, entityId: '__legacy__' })
    })
  }

  return {
    id: raw.id ?? '',
    label: raw.label ?? '',
    isDefault,
    assignments,
    publishedAt: raw.publishedAt,
    iconColor: raw.iconColor,
    iconImage: raw.iconImage,
    iconSize: raw.iconSize,
    type: raw.type ?? 'gpg-p521',
    fingerprint: raw.fingerprint ?? '',
    fingerprintShort: raw.fingerprintShort ?? '',
    publicKey: raw.publicKey ?? '',
    addedAt: raw.addedAt ?? '',
  }
}

function readMeta(id: string): KeyRecord {
  return migrateRecord(JSON.parse(readFileSync(metaPath(id), 'utf-8')))
}

function writeMeta(record: KeyRecord): void {
  writeFileSync(metaPath(record.id), JSON.stringify(record, null, 2), { mode: 0o600 })
}

export async function generateKey(opts: GenerateKeyOptions): Promise<KeyRecord> {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'nistP521',
    userIDs: [{ name: opts.label, comment: 'bespok3d' }],
    format: 'armored',
  })

  const parsed = await openpgp.readKey({ armoredKey: publicKey })
  const fingerprint = parsed.getFingerprint().toUpperCase()
  const fingerprintShort = fingerprint.slice(-16)
  const id = fingerprint
  const existing = listKeys()

  const record: KeyRecord = {
    id,
    label: opts.label,
    isDefault: existing.length === 0,
    assignments: [],
    type: 'gpg-p521',
    fingerprint,
    fingerprintShort,
    publicKey,
    addedAt: new Date().toISOString().slice(0, 10),
  }

  writeMeta(record)
  writeFileSync(privPath(id), privateKey, { mode: 0o600 })

  return record
}

export function listKeys(): KeyRecord[] {
  const dir = keysDir()
  const records = readdirSync(dir)
    .filter((filename) => filename.endsWith('.meta.json'))
    .map((filename) => readJsonFile<RawRecord | null>(join(dir, filename), null))
    .filter((raw): raw is RawRecord => raw !== null)
    .map(migrateRecord)
    .sort((keyA, keyB) => keyA.addedAt.localeCompare(keyB.addedAt))

  // Ensure exactly one default; if none, promote the first
  const hasDefault = records.some((record) => record.isDefault)
  if (!hasDefault && records.length > 0) {
    records[0].isDefault = true
    writeMeta(records[0])
  }

  return records
}

export function removeKey(id: string): void {
  const wasDefault =
    existsSync(metaPath(id)) &&
    migrateRecord(JSON.parse(readFileSync(metaPath(id), 'utf-8'))).isDefault

  if (existsSync(metaPath(id))) rmSync(metaPath(id))
  if (existsSync(privPath(id))) rmSync(privPath(id))

  if (wasDefault) {
    const remaining = listKeys()
    if (remaining.length > 0) {
      remaining[0].isDefault = true
      writeMeta(remaining[0])
    }
  }
}

export function setDefault(id: string): void {
  listKeys().forEach((record) => {
    record.isDefault = record.id === id
    writeMeta(record)
  })
}

export function setAssignments(id: string, assignments: KeyAssignment[]): void {
  const record = readMeta(id)

  listKeys()
    .filter((otherKey) => otherKey.id !== id)
    .forEach((otherKey) => {
      var changed = false
      const next = otherKey.assignments.filter((existing) => {
        const conflicts = assignments.some(
          (incoming) =>
            incoming.purpose === existing.purpose && incoming.entityId === existing.entityId
        )
        if (conflicts) changed = true

        return !conflicts
      })
      if (changed) {
        otherKey.assignments = next
        writeMeta(otherKey)
      }
    })

  record.assignments = assignments
  writeMeta(record)
}

export function setPublishedAt(id: string, date: string | null): void {
  const record = readMeta(id)
  if (date) record.publishedAt = date
  else delete record.publishedAt
  writeMeta(record)
}

export function setKeyIcon(id: string, color?: string, image?: string, size?: number): void {
  const record = readMeta(id)
  record.iconColor = color
  record.iconImage = image
  record.iconSize = size
  writeMeta(record)
}

export function exportPublicKey(id: string): string {
  return readMeta(id).publicKey
}

export function exportPrivateKey(id: string): string {
  return readFileSync(privPath(id), 'utf-8')
}

const BESPOK3D_PROFILES = ['Bespok3d', 'Bespok3d Staging', 'Bespok3d Dev', 'Bespok3d Beta'] as const

function profileKeyPath(profileName: string, fingerprint: string, extension: string): string {
  if (!BESPOK3D_PROFILES.some((name) => name === profileName)) throw new Error('Unknown Bespok3d profile')
  if (!/^[0-9a-f]{40}$/i.test(fingerprint)) throw new Error('Invalid key fingerprint')

  return join(app.getPath('appData'), profileName, 'keys', `${fingerprint.toUpperCase()}.${extension}`)
}

async function matchingPrivateKey(profileName: string, fingerprint: string): Promise<string | null> {
  const path = profileKeyPath(profileName, fingerprint, 'priv.asc')
  if (!existsSync(path) || !lstatSync(path).isFile()) return null
  try {
    const armoredKey = readFileSync(path, 'utf8')
    const key = await openpgp.readPrivateKey({ armoredKey })

    return key.getFingerprint().toUpperCase() === fingerprint.toUpperCase() ? armoredKey : null
  } catch {
    return null
  }
}

export function hasPrivateKey(fingerprint: string): boolean {
  return existsSync(privPath(fingerprint.toUpperCase()))
}

export async function hasMatchingPrivateKey(fingerprint: string): Promise<boolean> {
  const path = privPath(fingerprint.toUpperCase())
  if (!existsSync(path) || !lstatSync(path).isFile()) return false
  try {
    const key = await openpgp.readPrivateKey({ armoredKey: readFileSync(path, 'utf8') })

    return key.getFingerprint().toUpperCase() === fingerprint.toUpperCase()
  } catch {
    return false
  }
}

export async function localProfilesWithKey(fingerprint: string): Promise<string[]> {
  const profiles = BESPOK3D_PROFILES.filter((name) =>
    join(app.getPath('appData'), name) !== app.getPath('userData'))
  const matches = await Promise.all(profiles.map(async (name) => ({ name, key: await matchingPrivateKey(name, fingerprint) })))

  return matches.filter((match) => match.key !== null).map((match) => match.name)
}

export async function importKeyFromProfile(fingerprint: string, profileName: string, publishedPublicKey: string): Promise<KeyRecord> {
  const publicKey = await openpgp.readKey({ armoredKey: publishedPublicKey })
  if (publicKey.getFingerprint().toUpperCase() !== fingerprint.toUpperCase()) throw new Error('Published key does not match the requested fingerprint')
  const privateKey = await matchingPrivateKey(profileName, fingerprint)
  if (!privateKey) throw new Error('Matching private key not found in this Bespok3d profile')
  if (join(app.getPath('appData'), profileName) === app.getPath('userData')) throw new Error('Choose another Bespok3d profile')
  if (hasPrivateKey(fingerprint)) throw new Error('This app already has this private key')

  const sourceMeta = profileKeyPath(profileName, fingerprint, 'meta.json')
  if (!existsSync(sourceMeta) || !lstatSync(sourceMeta).isFile()) throw new Error('Source key details not found')
  const sourceRecord = readMetaFromProfile(sourceMeta)
  const existing = listKeys().find((key) => key.id === fingerprint.toUpperCase())
  if (existing && existing.publicKey !== publishedPublicKey) throw new Error('Local public key differs from the published key')
  const record: KeyRecord = existing ?? {
    ...sourceRecord, id: fingerprint.toUpperCase(), fingerprint: fingerprint.toUpperCase(),
    fingerprintShort: fingerprint.slice(-16).toUpperCase(), publicKey: publishedPublicKey,
    isDefault: listKeys().length === 0, assignments: [],
  }
  writeFileSync(privPath(record.id), privateKey, { flag: 'wx', mode: 0o600 })
  try {
    if (!existing) writeFileSync(metaPath(record.id), JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 })
  } catch (error) {
    rmSync(privPath(record.id))
    throw error
  }

  return record
}

function readMetaFromProfile(path: string): KeyRecord {
  const record = migrateRecord(JSON.parse(readFileSync(path, 'utf8')))
  if (!record.label) throw new Error('Source key has no label')

  return record
}
