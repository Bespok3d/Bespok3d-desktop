// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Reading a `.b3` that this build ships with, for a caller that installs it with no network at all:
// enrollment puts the daemon and the printer's jinni on a printer this way. The bytes go through the
// same verifier the store uses, so shipping in the app is not a shortcut past the signing chain, and an
// unsigned local build still installs at tier 'unknown' exactly as it does from the store.
import AdmZip from 'adm-zip'
import { readFileSync } from 'fs'
import { join } from 'path'

import { bundledRegistryDir } from '../registry/bundled-dir'
import type { IndexEntry, MergedEntry, PackageTrust } from '../registry/model'
import { PAYLOAD_PREFIX, payloadMembers } from './payload-entries'
import { verifiedPackageTrust } from './verify-package'

export interface BundledPackage {
  name: string
  version: string
  trust: PackageTrust
  // Payload paths relative to the payload root, so no caller has to spell the archive layout.
  payloadPaths: readonly string[]
  payloadBytes(payloadPath: string): Buffer
}

function bundledEntry(packageName: string): MergedEntry {
  const indexPath = join(bundledRegistryDir(), 'index.json')
  const catalogue = JSON.parse(readFileSync(indexPath, 'utf8')) as { plugins?: IndexEntry[] }
  const shipped = (catalogue.plugins ?? []).find((candidate) => candidate.name === packageName)
  if (!shipped) throw new Error(`this build ships no package named "${packageName}", so there is nothing to install`)

  return { ...shipped, trust: 'project', signer: null, registry_url: indexPath }
}

function payloadMember(members: readonly AdmZip.IZipEntry[], packageName: string, payloadPath: string): Buffer {
  const member = members.find((candidate) => candidate.entryName === `${PAYLOAD_PREFIX}${payloadPath}`)
  if (!member) throw new Error(`the package for "${packageName}" carries no "${payloadPath}"`)

  return member.getData()
}

// Reading ONE payload member without the signature check, for a caller that needs a value to work out
// its own local strings and puts nothing on a printer: the adapter reads the printer's path variables
// and its jinni version this way. Everything that reaches a printer goes through openBundledPackage
// below, so a tampered archive is still refused before a byte is uploaded.
/** @public */
export function unverifiedBundledPayload(packageName: string, payloadPath: string): Buffer {
  const entry = bundledEntry(packageName)
  const archive = new AdmZip(readFileSync(join(bundledRegistryDir(), String(entry.download_url))))

  return payloadMember(archive.getEntries(), packageName, payloadPath)
}

// Verification happens here, before the caller can read a single payload byte, so an enrollment cannot
// upload anything from a package whose signature does not check out.
export async function openBundledPackage(packageName: string): Promise<BundledPackage> {
  const entry = bundledEntry(packageName)
  const archiveBytes = readFileSync(join(bundledRegistryDir(), String(entry.download_url)))
  const trust = await verifiedPackageTrust(archiveBytes, entry)
  const members = payloadMembers(archiveBytes)

  return {
    name: entry.name,
    version: entry.version,
    trust,
    payloadPaths: members.map((member) => member.entryName.slice(PAYLOAD_PREFIX.length)),
    payloadBytes: (payloadPath: string) => payloadMember(members, packageName, payloadPath),
  }
}
