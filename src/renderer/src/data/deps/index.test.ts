import { describe, it, expect } from 'vitest'
import { resolveMissingDeps, installedDependents, installedConflicts, cascadeDependents } from './index'
import { indexToPlugins } from '../catalog/shape'
import type { IndexEntry } from '../types'
// @ts-expect-error - build-time generator, plain JS with no type declarations
import { buildIndex } from '../../../../../scripts/app-bundle.mjs'

// Mirror app-bundle.mjs discovery: plugins live in the sibling
// plugins/ tree (the repo split), excluding any payload manifest under files/ (e.g. remote-screen's
// PWA manifest) so cross-repo service deps (webcam-builtin -> camera-hw-accel) resolve as in the
// real build.
const RAW_MANIFESTS = import.meta.glob(
  [
    '../../../../../../plugins/**/manifest.json',
    '!**/files/**',
    '!**/doc/**',
    '!**/dist/**',
    '!**/node_modules/**',
    '!**/*-bleeding-edge/**',
  ],
  { eager: true, import: 'default' },
) as Record<string, Record<string, unknown>>

const ALL_MANIFESTS = Object.values(RAW_MANIFESTS)

const ENTRIES = (buildIndex(ALL_MANIFESTS).plugins as IndexEntry[]).map((entry) => ({
  ...entry,
  trust: 'project' as const,
  registry_url: 'bundled',
}))
const PLUGINS = indexToPlugins(ENTRIES, [])

describe('resolveMissingDeps', () => {
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

describe('installedConflicts', () => {
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

describe('installedDependents', () => {
  it('lists installed plugins that depend on the given plugin', () => {
    expect(installedDependents(PLUGINS, 'print-prefs-core', ['force-bed-mesh', 'force-timelapse', 'cpu-temp']))
      .toEqual(['force-bed-mesh', 'force-timelapse'])
  })

  it('returns empty when nothing installed depends on it', () => {
    expect(installedDependents(PLUGINS, 'print-prefs-core', ['cpu-temp'])).toEqual([])
  })
})

describe('cascadeDependents', () => {
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
