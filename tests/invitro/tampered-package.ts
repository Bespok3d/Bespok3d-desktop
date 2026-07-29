// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import AdmZip from 'adm-zip'

// The packaged plugin the live-daemon suites install, and the tamper derived from it. Shared because
// more than one suite needs the same pair: config-only, quick to place, and its manifest carries a
// sha256 for exactly one payload file, which is what makes the tampered case sharp.
const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_B3 = join(HERE, '../../dist/plugins/idle-timeout-0.1.0.b3')
// The one payload file idle-timeout's manifest carries a sha256 for.
const PAYLOAD_PATH = 'files/cfg/klipper/idle-timeout.cfg.tmpl'

export const FIXTURE_PLUGIN_ID = 'idle-timeout'

export function fixturePluginVars(): Record<string, string> {
  return { IDLE_TIMEOUT_SECONDS: '7200' }
}

export function untamperedPackage(): Buffer {
  return readFileSync(PLUGIN_B3)
}

// A package that is structurally valid and whose manifest still advertises the ORIGINAL sha256, with
// one payload file rewritten underneath it. adm-zip rewrites only the named entry, so the manifest
// bytes reaching the daemon are the packer's own. Tampering AFTER packing is exactly what a package
// altered in transit or at rest looks like.
export function packageWithTamperedPayload(): Buffer {
  const archive = new AdmZip(untamperedPackage())
  const payload = archive.readAsText(PAYLOAD_PATH)
  archive.updateFile(PAYLOAD_PATH, Buffer.from(`${payload}\n# altered after packing\n`))

  return archive.toBuffer()
}
