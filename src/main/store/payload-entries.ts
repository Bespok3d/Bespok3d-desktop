// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What a package would place on a printer, read from the archive bytes without unpacking anything.
//
// Everything a package deploys sits under one member prefix inside the `.b3`; the rest of the archive is
// the manifest, its signature and the docs, none of which reach the printer. Both the reader that
// installs a package this build ships and the check that refuses two packages writing over each other
// need that same list, so where it lives in the archive is spelled out once.
import AdmZip from 'adm-zip'
import { PackageRefusedError } from './package-refused'

export const PAYLOAD_PREFIX = 'files/'

// A `.b3` is a zip, and bytes that are not one are not a package. A download cut short, an error page
// saved under the package's name, or a file built wrong all arrive here as bytes, and the zip reader
// refuses them in its own words: no plugin named, and worded like the machinery went wrong. That is the
// one thing it is not, and it is the difference between a Try again that might work and a Try again that
// fetches the same wrong bytes forever. Opened here, once, so every reader of a package's contents
// refuses it as a package, in the app's own sentence, naming the plugin the user was waiting for.
export function packageArchive(archiveBytes: Buffer, packageName: string): AdmZip {
  try {
    return new AdmZip(archiveBytes)
  } catch {
    throw new PackageRefusedError(`the package for "${packageName}" is not a readable .b3 archive, so it was not installed`)
  }
}

export function payloadMembers(archiveBytes: Buffer, packageName: string): readonly AdmZip.IZipEntry[] {
  return packageArchive(archiveBytes, packageName).getEntries()
    .filter((member) => !member.isDirectory && member.entryName.startsWith(PAYLOAD_PREFIX))
}

// Paths relative to the payload root, so no caller has to spell the archive layout.
export function payloadPaths(archiveBytes: Buffer, packageName: string): readonly string[] {
  return payloadMembers(archiveBytes, packageName).map((member) => member.entryName.slice(PAYLOAD_PREFIX.length))
}
