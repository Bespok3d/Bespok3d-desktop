// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The truthful source list for the Repositories pane: take every configured source (built-in or
// user-added) and pair it with its real post-resolve state, so the pane shows a loaded count, a
// classified failure, or a switched-off row rather than a fabricated single entry.
import type { CatalogResult, RegistryTrust, SourceFailureReason } from '../model'
import { normalizeRegistryUrl } from './url'

export type SourceStatus = 'ok' | 'failed' | 'disabled'

// A source the app knows about (built-in or user-added), before any fetch. `label` is its
// human-readable identifier (a github coordinate or "bundled"), `name` its catalog title.
export interface ConfiguredSource {
  url: string
  label: string
  name: string
  trust: RegistryTrust
  locked: boolean
}

export interface SourceRow extends ConfiguredSource {
  enabled: boolean
  status: SourceStatus
  pluginCount: number
  error: string | null
  reason: SourceFailureReason | null
}

function describeDrop(drops: string[], url: string): string {
  return drops.find((entry) => entry.includes(url)) ?? 'failed to load'
}

function failedRow(source: ConfiguredSource, result: CatalogResult): SourceRow {
  const failure = result.failures.find((entry) => normalizeRegistryUrl(entry.url) === normalizeRegistryUrl(source.url))

  return {
    ...source,
    enabled: true,
    status: 'failed',
    pluginCount: 0,
    error: failure?.message ?? describeDrop(result.drops, source.url),
    reason: failure?.reason ?? 'unknown',
  }
}

function sourceRow(source: ConfiguredSource, result: CatalogResult, disabled: Set<string>): SourceRow {
  if (disabled.has(normalizeRegistryUrl(source.url))) {
    return { ...source, enabled: false, status: 'disabled', pluginCount: 0, error: null, reason: null }
  }
  const summary = result.registries.find((entry) => normalizeRegistryUrl(entry.url) === normalizeRegistryUrl(source.url))
  if (summary) return { ...source, enabled: true, status: 'ok', pluginCount: summary.pluginCount, error: null, reason: null }

  return failedRow(source, result)
}

export function buildSources(configured: ConfiguredSource[], result: CatalogResult, disabled: Set<string>): SourceRow[] {
  return configured.map((source) => sourceRow(source, result, disabled))
}
