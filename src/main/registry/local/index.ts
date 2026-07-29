// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// User-managed local plugin registry: testers drop .b3 files and they become an installable "local"
// source that coexists with the bundled + online ones. It is just another DISK source
// (userData/local-plugins/index.json + sibling .b3 files), resolved by the same machinery as the
// bundled index. This file owns the on-disk store mechanics: the layout paths, the origin sidecar,
// ingest/remove of dropped packages, and reading a staged doc. The index-entry shape lives in
// build-index.ts and the .b3 manifest contract in b3-manifest.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname, relative, isAbsolute } from 'node:path'
import AdmZip from 'adm-zip'
import { readJsonFile } from '../../json-store'
import { userDataPath } from '../../app-paths'
import { buildLocalIndex } from './build-index'
import { B3ValidationError, parseManifest, metadataComplete } from './b3-manifest'
import type { StoredManifest } from './b3-manifest'

const DOC_PREFIX = 'doc/'

export interface ParsedLocalPackage {
  id: string
  version: string
  title: string
  metadataComplete: boolean
}

export interface AddLocalResult {
  added: ParsedLocalPackage[]
  errors: { file: string; message: string }[]
}

export function userLocalDir(): string {
  return userDataPath('local-plugins')
}

export function userLocalIndexPath(): string {
  return join(userLocalDir(), 'index.json')
}

export function userLocalSourceUrl(): string {
  return userLocalIndexPath()
}

export function userLocalIndexExists(): boolean {
  return existsSync(userLocalIndexPath())
}

// Origin of a local package: 'sideloaded' (dropped onto the app) or 'created' (built in the Create
// tool, which takes the SAME ingest path). Persisted in a sidecar so the future UI can badge them
// apart; recorded now to avoid a data migration. The catalog/index shape is untouched (drift-safe).
export type LocalOrigin = 'sideloaded' | 'created'

function originsPath(): string {
  return join(userLocalDir(), 'origins.json')
}

function readOrigins(): Record<string, LocalOrigin> {
  return readJsonFile<Record<string, LocalOrigin>>(originsPath(), {})
}

function setOrigin(id: string, origin: LocalOrigin): void {
  writeFileSync(originsPath(), `${JSON.stringify({ ...readOrigins(), [id]: origin }, null, 2)}\n`)
}

function clearOrigin(id: string): void {
  const origins = readOrigins()
  delete origins[id]
  writeFileSync(originsPath(), `${JSON.stringify(origins, null, 2)}\n`)
}

function ensureDir(): void {
  mkdirSync(userLocalDir(), { recursive: true })
}

function readStoredManifests(): StoredManifest[] {
  if (!existsSync(userLocalDir())) return []

  return readdirSync(userLocalDir())
    .filter((name) => name.endsWith('.b3'))
    .flatMap((name) => readManifestOf(join(userLocalDir(), name)))
}

function readManifestOf(b3Path: string): StoredManifest[] {
  try {
    return [parseManifest(new AdmZip(b3Path).readAsText('manifest.json'))]
  } catch {
    return []
  }
}

function reindex(): void {
  ensureDir()
  writeFileSync(userLocalIndexPath(), `${JSON.stringify(buildLocalIndex(readStoredManifests()), null, 2)}\n`)
}

function currentFileFor(id: string): string | undefined {
  if (!userLocalIndexExists()) return undefined
  const index = JSON.parse(readFileSync(userLocalIndexPath(), 'utf8')) as { plugins: { name: string; download_url: string }[] }

  return index.plugins.find((entry) => entry.name === id)?.download_url
}

function removeStored(id: string): void {
  const file = currentFileFor(id)
  if (file) rmSync(join(userLocalDir(), file), { force: true })
  rmSync(join(userLocalDir(), id), { recursive: true, force: true })
}

function isInside(dir: string, target: string): boolean {
  const rel = relative(dir, target)

  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function stageDoc(zip: AdmZip, id: string): void {
  const docTarget = join(userLocalDir(), id, 'doc')
  const docMembers = zip.getEntries().filter((entry) => !entry.isDirectory && entry.entryName.startsWith(DOC_PREFIX))
  docMembers.forEach((entry) => writeDocMember(docTarget, entry))
}

function writeDocMember(docTarget: string, entry: AdmZip.IZipEntry): void {
  const dest = join(docTarget, entry.entryName.slice(DOC_PREFIX.length))
  if (!isInside(docTarget, dest)) return
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, entry.getData())
}

function openZip(filePath: string): AdmZip {
  try {
    return new AdmZip(filePath)
  } catch {
    throw new B3ValidationError('this file is not a .b3 archive (could not read it as a zip)')
  }
}

function readManifestText(zip: AdmZip): string {
  const entry = zip.getEntry('manifest.json')
  if (!entry) throw new B3ValidationError('this .b3 has no manifest.json')

  return zip.readAsText(entry)
}

function ingestOne(filePath: string, origin: LocalOrigin): ParsedLocalPackage {
  const zip = openZip(filePath)
  const manifest = parseManifest(readManifestText(zip))
  removeStored(manifest.name)
  ensureDir()
  writeFileSync(join(userLocalDir(), `${manifest.name}-${manifest.version}.b3`), readFileSync(filePath))
  stageDoc(zip, manifest.name)
  setOrigin(manifest.name, origin)

  return { id: manifest.name, version: manifest.version, title: (manifest.title as string) ?? manifest.name, metadataComplete: metadataComplete(manifest) }
}

function addOne(filePath: string, result: AddLocalResult, origin: LocalOrigin): void {
  try {
    result.added.push(ingestOne(filePath, origin))
  } catch (error) {
    const reason = error instanceof B3ValidationError ? error.message : 'it could not be read'
    result.errors.push({ file: filePath, message: `This isn't a valid .b3: ${reason}.` })
  }
}

export function addLocalPackages(paths: string[], origin: LocalOrigin = 'sideloaded'): AddLocalResult {
  const result: AddLocalResult = { added: [], errors: [] }
  paths.forEach((filePath) => addOne(filePath, result, origin))
  if (result.added.length > 0) reindex()

  return result
}

export function removeLocalPackage(id: string): void {
  clearOrigin(id)
  removeStored(id)
  if (readStoredManifests().length === 0) {
    rmSync(userLocalDir(), { recursive: true, force: true })

    return
  }
  reindex()
}

// Read a staged doc file for the Doc tab of a sideloaded plugin, guarded against path traversal.
export function readLocalDoc(id: string, relativePath: string): string | null {
  const docFile = join(userLocalDir(), id, 'doc', relativePath)
  if (!isInside(join(userLocalDir(), id, 'doc'), docFile) || !existsSync(docFile)) return null

  return readFileSync(docFile, 'utf8')
}
