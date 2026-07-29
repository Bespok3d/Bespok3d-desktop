// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'fs'

// Reads JSON from disk, returning `fallback` when the file is missing, unreadable, or holds corrupt
// JSON. A damaged on-disk store must degrade to a safe default instead of throwing into a load path
// and white-screening the app: a single-file store passes its DEFAULTS, and a list-loader passes a
// per-file `null` and drops just the bad file. One reader so the resilience is uniform across the
// app's userData stores (printers, keys, settings, git-host, registry cache, local origins).
export function readJsonFile<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}
