// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { buildSources } from './sources'
import type { ConfiguredSource } from './sources'
import { normalizeRegistryUrl } from './url'
import type { CatalogResult, RegistrySummary, SourceFailure } from '../model'

function catalogResult(registries: RegistrySummary[], drops: string[] = [], failures: SourceFailure[] = []): CatalogResult {
  return { name: 'Official', publisher: '', updated: '', trust: 'project', plugins: [], collections: [], registries, drops, failures }
}

function summary(url: string, pluginCount: number): RegistrySummary {
  return { url, name: 'Official', trust: 'project', pluginCount, enabled: true, locked: true }
}

function configured(url: string): ConfiguredSource {
  return { url, label: url, name: 'Official', trust: 'project', locked: true }
}

describe('buildSources', () => {
  const url = 'github:org/main-index/index.json'

  it('marks an enabled, fetched source ok with its plugin count', () => {
    const rows = buildSources([configured(url)], catalogResult([summary(url, 3)]), new Set())
    expect(rows[0]).toMatchObject({ status: 'ok', enabled: true, pluginCount: 3, error: null })
  })

  // The pane row is the one place an owner looks when a source seems wrong, so it must show what the
  // resolver concluded and not what the source was configured as. A source configured as the project
  // whose signature did not check out loaded fine (status stays ok) and reads 'failed' as its tier.
  it('shows the resolved tier on the row, not the configured one', () => {
    const resolved: RegistrySummary = { ...summary(url, 3), trust: 'failed' }
    const rows = buildSources([configured(url)], catalogResult([resolved]), new Set())
    expect(rows[0]).toMatchObject({ status: 'ok', trust: 'failed' })
  })

  it('marks an enabled source that failed to fetch as failed with the drop detail', () => {
    const rows = buildSources([configured(url)], catalogResult([], [`fetch failed: ${url} (HTTP 404)`]), new Set())
    expect(rows[0].status).toBe('failed')
    expect(rows[0].error).toContain('404')
  })

  it('surfaces the classified failure reason and message on a failed source', () => {
    const failures = [{ url, reason: 'auth' as const, message: 'Sign in to GitHub to load this private list' }]
    const rows = buildSources([configured(url)], catalogResult([], [], failures), new Set())
    expect(rows[0]).toMatchObject({ status: 'failed', reason: 'auth', error: 'Sign in to GitHub to load this private list' })
  })

  it('marks a disabled source off and reports no count even when it could fetch', () => {
    const rows = buildSources([configured(url)], catalogResult([summary(url, 3)]), new Set([normalizeRegistryUrl(url)]))
    expect(rows[0]).toMatchObject({ status: 'disabled', enabled: false, pluginCount: 0, error: null })
  })

  // The disabled set is keyed by NORMALIZED url, and sourceRow normalizes source.url at the check, so a
  // non-canonical configured url (mixed case, trailing slash) still matches its normalized disabled key.
  it('disables a source whose configured url is non-canonical via the normalized key', () => {
    const messy = 'GitHub:Org/Main-Index/Index.json/'
    const rows = buildSources([configured(messy)], catalogResult([summary(messy, 3)]), new Set([normalizeRegistryUrl(messy)]))
    expect(rows[0]).toMatchObject({ status: 'disabled', enabled: false })
  })

  // A locked source is toggle-off-able but never dropped: buildSources maps 1:1, so a disabled locked
  // source still appears in the list, carrying locked:true so the pane shows it (not-removable half).
  it('keeps a disabled locked source in the list with locked preserved', () => {
    const rows = buildSources([configured(url)], catalogResult([]), new Set([normalizeRegistryUrl(url)]))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ locked: true, enabled: false, status: 'disabled' })
  })
})
