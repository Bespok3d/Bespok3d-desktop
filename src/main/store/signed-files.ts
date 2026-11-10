// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A package's signed file list held up against what the printer says its copy of each file hashes to.
// The manifest names every file with the sha256 it was signed with, and a zip member is named by that
// same path, so a file the printer already holds as signed is a member the upload can leave out, and a
// file it holds any other way (or not at all) is a member a repair has to send back.
import type { PrinterFileHashes } from '../daemon-client/client'
import { parseManifest } from '../registry/local/b3-manifest'
import { packageArchive } from './payload-entries'

export type SignedFileHashes = ReadonlyMap<string, string>

interface SignedFile {
  path: string
  sha256: string
}

// A listed file without a hash vouches for nothing, so it is never left out and never compared.
function isSignedFile(listed: unknown): listed is SignedFile {
  if (typeof listed !== 'object' || listed === null) return false
  const { path, sha256 } = listed as Record<string, unknown>

  return typeof path === 'string' && typeof sha256 === 'string'
}

// Read from a package that already verified, so its manifest is there and parses.
export function signedFileHashes(archiveBytes: Buffer, pluginId: string): SignedFileHashes {
  const manifestMember = packageArchive(archiveBytes, pluginId).getEntry('manifest.json')
  if (!manifestMember) return new Map()
  const listedFiles = parseManifest(manifestMember.getData().toString('utf8')).files
  const signedFiles = Array.isArray(listedFiles) ? listedFiles.filter(isSignedFile) : []

  return new Map(signedFiles.map((file) => [file.path, file.sha256]))
}

export function filesHeldAsSigned(signed: SignedFileHashes, printerHashes: PrinterFileHashes): Set<string> {
  const heldAsSigned = Object.entries(printerHashes).filter(([path, printerHash]) => printerHash !== null && signed.get(path) === printerHash)

  return new Set(heldAsSigned.map(([path]) => path))
}

export function filesChangedOnPrinter(signed: SignedFileHashes, printerHashes: PrinterFileHashes): Set<string> {
  const changed = Object.entries(printerHashes).filter(([path, printerHash]) => signed.has(path) && signed.get(path) !== printerHash)

  return new Set(changed.map(([path]) => path))
}

// The same package with only the members a caller keeps. Every kept member's bytes stay exactly as they
// were, the manifest and its signature included, so the copy still verifies against the same signature.
export function archiveKeeping(archiveBytes: Buffer, pluginId: string, isKept: (memberName: string) => boolean): Buffer {
  const archive = packageArchive(archiveBytes, pluginId)
  archive.getEntries().filter((member) => !isKept(member.entryName)).forEach((member) => archive.deleteEntry(member))

  return archive.toBuffer()
}
