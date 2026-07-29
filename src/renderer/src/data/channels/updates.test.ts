// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { pluginUpdateCount } from './updates'
import { indexToPlugins } from '../catalog/shape'
import type { IndexEntry, Printer } from '../types'
import { PLUGIN_MANIFESTS, NO_PLUGIN_SOURCES } from '../../test/plugin-sources'
// @ts-expect-error - build-time generator, plain JS with no type declarations
import { buildIndex } from '../../../../../scripts/app-bundle.mjs'

const PLUGINS = indexToPlugins(
  (buildIndex(PLUGIN_MANIFESTS).plugins as IndexEntry[]).map((entry) => ({
    ...entry,
    trust: 'project' as const,
    registry_url: 'bundled',
  })),
  [],
)
const known = PLUGINS[0]

function makePrinter(installedVersions: Record<string, string>): Printer {
  return {
    id: 'p1',
    nick: 'Test',
    model: 'U1',
    adapter: 'snapmaker-u1',
    host: 'test.local',
    ip: '10.0.0.1',
    status: 'managed',
    installedIds: Object.keys(installedVersions),
    installedVersions,
  }
}

describe.skipIf(NO_PLUGIN_SOURCES)('pluginUpdateCount', () => {
  it('counts a plugin whose installed version differs from the catalog', () => {
    expect(pluginUpdateCount(makePrinter({ [known.id]: `old-${known.version}` }), PLUGINS)).toBe(1)
  })

  it('does not count a plugin already at the catalog version', () => {
    expect(pluginUpdateCount(makePrinter({ [known.id]: known.version }), PLUGINS)).toBe(0)
  })

  it('ignores empty version strings and unknown plugin ids', () => {
    expect(pluginUpdateCount(makePrinter({ [known.id]: '', 'not-a-plugin': '9.9.9' }), PLUGINS)).toBe(0)
  })

  it('returns 0 when installedVersions is absent', () => {
    const printer = makePrinter({})
    delete (printer as { installedVersions?: Record<string, string> }).installedVersions
    expect(pluginUpdateCount(printer, PLUGINS)).toBe(0)
  })
})
