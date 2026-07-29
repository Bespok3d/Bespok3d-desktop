// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { dedupeEntries, collapseToVariants, resolveCrossSourceDeps } from './merge'
import type { MergedEntry } from '../model'

describe('dedupeEntries', () => {
  function merged(name: string, version: string, trust: MergedEntry['trust']): MergedEntry {
    return { name, version, trust, signer: null, registry_url: trust }
  }

  it('keeps the higher-trust source when a plugin appears twice', () => {
    const deduped = dedupeEntries([merged('x', '1.0.0', 'community'), merged('x', '1.0.0', 'project')])
    expect(deduped).toHaveLength(1)
    expect(deduped[0].trust).toBe('project')
  })

  it('keeps the newer version when trust is equal', () => {
    const deduped = dedupeEntries([merged('x', '1.0.0', 'project'), merged('x', '2.0.0', 'project')])
    expect(deduped[0].version).toBe('2.0.0')
  })
})

describe('collapseToVariants', () => {
  function at(name: string, registryUrl: string, version: string): MergedEntry {
    return { name, version, trust: 'project', registry_url: registryUrl } as MergedEntry
  }

  it('groups the same plugin name from several sources into one winner carrying every variant', () => {
    const result = collapseToVariants([at('cam', 'bundled', '0.1.0'), at('cam', 'github:o/r/index.json', '0.1.0')])
    expect(result).toHaveLength(1)
    expect(result[0].variants).toHaveLength(2)
  })

  it('picks the newest version as the winner and keeps first-seen order across names', () => {
    const result = collapseToVariants([at('cam', 'a', '0.1.0'), at('cam', 'b', '0.2.0'), at('rfid', 'a', '1.0.0')])
    expect(result.map((entry) => entry.name)).toEqual(['cam', 'rfid'])
    expect(result[0].version).toBe('0.2.0')
  })
})

describe('resolveCrossSourceDeps', () => {
  function withDeps(name: string, deps: string[], provides: string[] = []): MergedEntry {
    return { name, version: '1.0.0', trust: 'project', signer: null, registry_url: name, deps, provides } as MergedEntry
  }

  it('maps a leaked service-name dep to its provider plugin id across sources', () => {
    const resolved = resolveCrossSourceDeps([withDeps('spoolman', ['rfid-service']), withDeps('rfid-ntag', [], ['rfid-service'])])
    expect(resolved.find((plugin) => plugin.name === 'spoolman')?.deps).toEqual(['rfid-ntag'])
  })

  it('leaves an already-resolved plugin-id dep untouched', () => {
    const resolved = resolveCrossSourceDeps([withDeps('spoolman', ['rfid-ntag']), withDeps('rfid-ntag', [], ['rfid-service'])])
    expect(resolved.find((plugin) => plugin.name === 'spoolman')?.deps).toEqual(['rfid-ntag'])
  })

  it('leaves an unresolvable service-name dep untouched so install errors truthfully', () => {
    const resolved = resolveCrossSourceDeps([withDeps('spoolman', ['rfid-service'])])
    expect(resolved.find((plugin) => plugin.name === 'spoolman')?.deps).toEqual(['rfid-service'])
  })

  it('dedupes when two requirements resolve to the same provider', () => {
    const resolved = resolveCrossSourceDeps([withDeps('app', ['rfid-service', 'rfid-ntag']), withDeps('rfid-ntag', [], ['rfid-service'])])
    expect(resolved.find((plugin) => plugin.name === 'app')?.deps).toEqual(['rfid-ntag'])
  })
})
