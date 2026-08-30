// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import AdmZip from 'adm-zip'

// The packaged plugin the live-daemon suites install, and the tamper derived from it. Shared because
// more than one suite needs the same pair: config-only, quick to place, and its manifest carries a
// sha256 for exactly one payload file, which is what makes the tampered case sharp.
const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLED_PACKAGES = join(HERE, '../../dist/plugins')
// The one payload file idle-timeout's manifest carries a sha256 for.
const PAYLOAD_PATH = 'files/cfg/klipper/idle-timeout.cfg.tmpl'

export const FIXTURE_PLUGIN_ID = 'idle-timeout'

// Taken from the bundle by id, never by a pinned version: the plugin releases on its own cadence, and a
// suite that names one version goes red the day it ships another. A developer bundle curated down to
// the plugins they are working on carries none at all, which is a stand-down, not a failure.
function bundledFixturePath(): string {
  const packed = readdirSync(BUNDLED_PACKAGES).filter((entry) => entry.startsWith(`${FIXTURE_PLUGIN_ID}-`) && entry.endsWith('.b3'))

  return packed.length > 0 ? join(BUNDLED_PACKAGES, packed[0]) : ''
}

export const FIXTURE_PACKAGE_BUNDLED = Boolean(bundledFixturePath())

export function fixturePluginVars(): Record<string, string> {
  return { IDLE_TIMEOUT_SECONDS: '7200' }
}

export function untamperedPackage(): Buffer {
  const packed = bundledFixturePath()
  if (!packed) throw new Error(`this build bundles no ${FIXTURE_PLUGIN_ID} package to tamper with`)

  return readFileSync(packed)
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
