// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { resolveMissingDeps, installedDependents, installedConflicts, cascadeDependents } from './index'
import { indexToPlugins } from '../catalog/shape'
import type { IndexEntry } from '../types'
import { PLUGIN_MANIFESTS, NO_PLUGIN_SOURCES } from '../../test/plugin-sources'
// @ts-expect-error - build-time generator, plain JS with no type declarations
import { buildIndex } from '../../../../../scripts/app-bundle.mjs'

const ENTRIES = (buildIndex(PLUGIN_MANIFESTS).plugins as IndexEntry[]).map((entry) => ({
  ...entry,
  trust: 'project' as const,
  registry_url: 'bundled',
}))
const PLUGINS = indexToPlugins(ENTRIES, [])

describe.skipIf(NO_PLUGIN_SOURCES)('resolveMissingDeps', () => {
  it('returns the core dependency when a force plugin needs it and it is absent', () => {
    expect(resolveMissingDeps(PLUGINS, 'force-bed-mesh', [])).toEqual(['print-prefs-core'])
  })

  it('returns nothing when the dependency is already installed', () => {
    expect(resolveMissingDeps(PLUGINS, 'force-bed-mesh', ['print-prefs-core'])).toEqual([])
  })

  it('returns nothing for a plugin with no dependencies', () => {
    expect(resolveMissingDeps(PLUGINS, 'cpu-temp', [])).toEqual([])
  })

  it('derives store deps from the manifest service graph', () => {
    expect(resolveMissingDeps(PLUGINS, 'webcam-builtin', [])).toEqual(['camera-hw-accel'])
  })

  it('pulls in rfid-ntag for spoolman from its declared service dependency', () => {
    expect(resolveMissingDeps(PLUGINS, 'spoolman', [])).toEqual(['rfid-ntag'])
  })
})

describe.skipIf(NO_PLUGIN_SOURCES)('installedConflicts', () => {
  it('reports a mutually-exclusive plugin that is already installed', () => {
    expect(installedConflicts(PLUGINS, 'force-bed-mesh', ['force-bed-mesh-adaptive']))
      .toEqual(['force-bed-mesh-adaptive'])
  })

  it('is symmetric: the reverse direction also reports the clash', () => {
    expect(installedConflicts(PLUGINS, 'force-bed-mesh-adaptive', ['force-bed-mesh']))
      .toEqual(['force-bed-mesh'])
  })

  it('returns empty when nothing installed conflicts', () => {
    expect(installedConflicts(PLUGINS, 'force-bed-mesh', ['cpu-temp'])).toEqual([])
  })
})

describe.skipIf(NO_PLUGIN_SOURCES)('installedDependents', () => {
  it('lists installed plugins that depend on the given plugin', () => {
    expect(installedDependents(PLUGINS, 'print-prefs-core', ['force-bed-mesh', 'force-timelapse', 'cpu-temp']))
      .toEqual(['force-bed-mesh', 'force-timelapse'])
  })

  it('returns empty when nothing installed depends on it', () => {
    expect(installedDependents(PLUGINS, 'print-prefs-core', ['cpu-temp'])).toEqual([])
  })
})

describe.skipIf(NO_PLUGIN_SOURCES)('cascadeDependents', () => {
  it('lists installed dependents of the selection that are not themselves selected', () => {
    expect(cascadeDependents(PLUGINS, ['print-prefs-core'], ['print-prefs-core', 'force-bed-mesh', 'force-timelapse', 'cpu-temp']))
      .toEqual(['force-bed-mesh', 'force-timelapse'])
  })

  it('excludes a dependent already in the selection (the whole batch removes together)', () => {
    expect(cascadeDependents(PLUGINS, ['print-prefs-core', 'force-bed-mesh', 'force-timelapse'], ['print-prefs-core', 'force-bed-mesh', 'force-timelapse']))
      .toEqual([])
  })

  it('is empty when nothing installed depends on the selection', () => {
    expect(cascadeDependents(PLUGINS, ['print-prefs-core'], ['print-prefs-core', 'cpu-temp'])).toEqual([])
  })
})
