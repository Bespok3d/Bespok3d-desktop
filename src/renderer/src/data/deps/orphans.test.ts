// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { orphanPlugins } from './orphans'
import type { Plugin } from '../types'

function catalogPlugin(id: string): Plugin {
  return {
    id, name: id, title: id, category: 'other', tagline: '', description: '', version: '1.0.0',
    channel: 'stable', publisher: 'org', signer: null, trust: 'project', deps: [], conflicts: [], sources: [],
  }
}

describe('orphanPlugins', () => {
  it('synthesizes an entry for an installed id no catalog source offers', () => {
    const catalog = [catalogPlugin('spoolman')]
    const orphans = orphanPlugins(catalog, ['spoolman', 'my-local'], { spoolman: '1.0.0', 'my-local': '0.2.0' })
    expect(orphans.map((plugin) => plugin.id)).toEqual(['my-local'])
    expect(orphans[0].sources).toEqual([])
    expect(orphans[0].version).toBe('0.2.0')
  })

  it('returns nothing when every installed id is in the catalog', () => {
    const catalog = [catalogPlugin('spoolman')]
    expect(orphanPlugins(catalog, ['spoolman'], { spoolman: '1.0.0' })).toEqual([])
  })

  it('returns nothing when nothing is installed', () => {
    expect(orphanPlugins([catalogPlugin('spoolman')], [], {})).toEqual([])
  })

  it('falls back to an empty version string when the live version is unknown', () => {
    const orphans = orphanPlugins([], ['ghost'], {})
    expect(orphans[0].version).toBe('')
  })
})
