// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MergedEntry } from '../registry/model'
import type { PackageOrigin } from './catalog-variant'
import { catalogVariantOrNone } from './catalog-variant'

// What a package needs, read off the very entry whose bytes are going to the printer. A plugin name
// can stand at several sources at once, and the copy on the printer is not always the one that won
// the catalog: reading the winner's requirements while sending the variant's bytes sends a package
// the printer refuses, naming a plugin the app never put in the batch and leaving the user stuck.
function catalogDepIds(catalog: readonly MergedEntry[], pluginId: string, origin: PackageOrigin): string[] {
  const declared = catalogVariantOrNone(catalog, pluginId, origin)?.deps

  return Array.isArray(declared) ? declared.filter((depId): depId is string => typeof depId === 'string') : []
}

// A dependency the app adds for itself is not the plugin the user picked and carries none of its
// provenance: it is taken from the same channel, at whichever source stands highest for its own name.
function dependencyOrigin(origin: PackageOrigin): PackageOrigin {
  return { channel: origin.channel }
}

export function declaresDependencies(
  catalog: readonly MergedEntry[],
  pluginId: string,
  declaredByCaller: readonly string[],
  origin: PackageOrigin = {},
): boolean {
  return declaredByCaller.length > 0 || catalogDepIds(catalog, pluginId, origin).length > 0
}

export function missingDependencyIds(
  catalog: readonly MergedEntry[],
  pluginId: string,
  declaredByCaller: readonly string[],
  installedIds: readonly string[],
  origin: PackageOrigin = {},
): string[] {
  const ordered: string[] = []
  const walked = new Set<string>()
  const depOrigin = dependencyOrigin(origin)

  function walk(depId: string): void {
    if (walked.has(depId)) return
    walked.add(depId)
    catalogDepIds(catalog, depId, depOrigin).forEach(walk)
    if (!installedIds.includes(depId)) ordered.push(depId)
  }

  catalogDepIds(catalog, pluginId, origin).forEach(walk)
  declaredByCaller.forEach(walk)

  return ordered
}
