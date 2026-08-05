// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'
import AdmZip from 'adm-zip'

// A minimal valid .b3 built in memory: one config file symlinked into $BESPOK3D, no service to start,
// so an in-vitro test can install something real on a real daemon without shipping a fixture archive or
// restarting anything on the device. Optional `templates` render a packaged `.tmpl` (paired with
// `extraFiles`) into the plugin dir, expanding a user var, so reconfigure has something to re-render.
export interface PluginSpec {
  name: string
  version?: string
  provides?: string[]
  depends?: string[]
  conflicts?: string[]
  templates?: Array<{ from: string; to: string }>
  extraFiles?: Array<{ path: string; content: string }>
}

function sha256Hex(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex')
}

export function buildPackage(spec: PluginSpec): Buffer {
  const probeConfig = Buffer.from(`# ${spec.name}\n`)
  const packagedExtras = (spec.extraFiles ?? []).map((extra) => ({
    path: extra.path, bytes: Buffer.from(extra.content),
  }))
  // The daemon refuses any archive member the manifest never declared (members.py: undeclared payload
  // is unsigned), verify_files treats a declared entry with no sha256 as a mismatch, and apply_modes
  // chmods every declared file by its octal mode (KeyError otherwise, which trips auto-deactivate), so
  // every packaged file is listed here with its real hash and a mode, exactly as b3-builder emits.
  const declaredFiles = [
    { path: 'files/probe.cfg', sha256: sha256Hex(probeConfig), mode: '644' },
    ...packagedExtras.map((extra) => ({ path: extra.path, sha256: sha256Hex(extra.bytes), mode: '644' })),
  ]
  const manifest = {
    name: spec.name,
    version: spec.version ?? '1.0.0',
    provides: spec.provides ?? [],
    depends: spec.depends ?? [],
    conflicts: spec.conflicts ?? [],
    install: {
      dirs: [],
      symlinks: [{ from: 'files/probe.cfg', to: `$BESPOK3D/${spec.name}.cfg` }],
      patches: [],
      templates: spec.templates ?? [],
      start: [],
    },
    files: declaredFiles,
  }
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
  zip.addFile('files/probe.cfg', probeConfig)
  packagedExtras.forEach((extra) => zip.addFile(extra.path, extra.bytes))

  return zip.toBuffer()
}
