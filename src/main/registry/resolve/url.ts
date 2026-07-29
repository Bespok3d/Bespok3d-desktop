// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RegistryRef } from '../model'

// Lowercase first, then strip surrounding whitespace and any trailing slash run together, so the
// result is idempotent: a char that case-folds to whitespace, or a space hidden before a trailing
// slash, would otherwise survive one pass and be removed on the next.
export function normalizeRegistryUrl(url: string): string {
  return url.toLowerCase().replace(/^\s+/, '').replace(/[/\s]+$/, '')
}

// The configured remote registry as a root ref, or null when none is set (default: bundled only).
// The `github:` scheme marks an index fetched through the git host's contents API (auth-correct on
// private repos), distinct from a plain http(s) registry url.
export function configuredRegistryRef(registryRepo: { owner: string; repo: string } | undefined): RegistryRef | null {
  if (!registryRepo) return null

  return { url: `github:${registryRepo.owner}/${registryRepo.repo}/index.json`, trust: 'project', locked: false }
}
