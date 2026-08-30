// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RecoverResult } from '@bespok3d/contract'

// A plugin already on the printer whose own manifest the daemon could not read. It is not a row of
// the batch: nothing was installed, updated or removed for it. It is a plugin the daemon walked past
// and could not make sense of, and this is how the printer says which one it cannot account for.
//
// `problem` is the daemon's word for the kind of unreadable, and `detail` is its one line about what
// actually failed to read or parse.
export interface ManifestWarning {
  plugin: string
  problem: string
  detail: string
}

// What a batch answer carries: the shared install/update/recover shape, plus the warnings the app
// reads off that same answer. The warnings are declared here rather than in @bespok3d/contract
// because the daemon does not send them yet. This is the reading half, written first, and the field
// is optional precisely because every daemon in the field today answers without it. When the daemon
// side lands, this moves into the shared contract and gains the generated-fixture drift guard the
// other response shapes already have (see `contract.test.ts` beside this file).
export interface BatchResult extends RecoverResult {
  manifestWarnings?: ManifestWarning[]
}

// The warnings in an answer, or none at all. Every one of these comes off the wire, so an entry that
// is not something the app can show is not a warning it will pretend to have: a malformed one is
// dropped rather than rendered as a broken row, and an answer carrying no warnings field at all is
// the ordinary case rather than an error.
export function manifestWarningsIn(raw: unknown): ManifestWarning[] | undefined {
  if (!Array.isArray(raw)) return undefined

  return raw
    .filter(isManifestWarning)
    .map((entry) => ({ plugin: entry.plugin, problem: entry.problem, detail: entry.detail }))
}

function isManifestWarning(entry: unknown): entry is ManifestWarning {
  if (entry === null || typeof entry !== 'object') return false
  const fields = entry as Partial<ManifestWarning>

  return typeof fields.plugin === 'string' && typeof fields.problem === 'string' && typeof fields.detail === 'string'
}
