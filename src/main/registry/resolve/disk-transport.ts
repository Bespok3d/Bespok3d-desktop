// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The bundled index, read straight off disk. No cache and no conditional GET: there is no network
// between us and the bytes, so there is nothing to get stale and nothing to map into a failure reason.
import { existsSync, readFileSync } from 'fs'
import type { RegistryRef, FetchedRegistry } from '../model'
import { toFetchedRegistry } from './served-index'

export async function fetchDiskRegistry(ref: RegistryRef): Promise<FetchedRegistry> {
  const served = { bytes: readFileSync(ref.url, 'utf8'), signature: readSignatureBeside(ref.url) }

  return toFetchedRegistry(ref, served, false)
}

function readSignatureBeside(path: string): string | null {
  const signaturePath = `${path}.sig`
  if (!existsSync(signaturePath)) return null

  return readFileSync(signaturePath, 'utf8')
}
