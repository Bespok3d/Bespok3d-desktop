// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, PluginSource, Printer, ReleaseChannel } from '../types'
import { isUpdateOffered } from '@bespok3d/contract'
import type { PackageBuild } from '@bespok3d/contract'
import { effectiveVariant, ALLOW_ALL_CHANNELS } from './index'
import type { CeilingResolver } from './index'

// What the printer already runs, as every update surface needs to read it: the version per plugin, the
// source each of those copies came from, and the channel ceiling the user picked. `sources` is absent on
// a record written before provenance was kept, and those copies keep the plain catalog pick.
// `fingerprints` is the build each copy came from, as the daemon names it; absent from an older daemon,
// and then an update is judged on versions alone.
export interface InstalledOnPrinter {
  versions: Record<string, string>
  sources?: Record<string, string>
  ceilingFor?: CeilingResolver
  disabledChannels?: ReleaseChannel[]
  fingerprints?: Record<string, string>
}

export function installedOnPrinter(printer: Printer, ceilingFor?: CeilingResolver, disabledChannels?: ReleaseChannel[]): InstalledOnPrinter {
  return installedFromRecords(printer.installedVersions ?? {}, printer.installedSources, ceilingFor, disabledChannels, printer.installedFingerprints)
}

// The same reading, for the surfaces that are handed the records rather than the printer itself.
export function installedFromRecords(versions: Record<string, string>, sources?: Record<string, string>, ceilingFor?: CeilingResolver, disabledChannels?: ReleaseChannel[], fingerprints?: Record<string, string>): InstalledOnPrinter {
  return { versions, sources, ceilingFor, disabledChannels, fingerprints }
}

// The plugin narrowed to the source its installed copy came from. An update means a newer build from the
// SAME place: a build packed locally is never replaced by the published copy that happens to carry a
// higher number, and a published install is never replaced by a local build. A recorded source the
// catalog no longer carries (a list dropped it, a sideloaded .b3 that is gone) leaves the whole plugin,
// so the copy on the printer can still be updated from wherever it is offered now.
function pluginAsItsInstalledSource(plugin: Plugin, installedSource: string): Plugin {
  const sameSource = (plugin.sources ?? []).filter((source) => source.registryUrl === installedSource)

  return sameSource.length === 0 ? plugin : { ...plugin, sources: sameSource }
}

// The variant an update to this plugin would install: the newest build from the installed copy's own
// source, within the user's ceiling. Undefined when that source offers nothing the ceiling allows.
export function updateVariant(plugin: Plugin, installed: InstalledOnPrinter): PluginSource | undefined {
  const ceiling = (installed.ceilingFor ?? ALLOW_ALL_CHANNELS)(plugin.id)
  const installedSource = installed.sources?.[plugin.id]
  const offering = installedSource ? pluginAsItsInstalledSource(plugin, installedSource) : plugin

  return effectiveVariant(offering, ceiling, installed.disabledChannels ?? [])
}

function variantBuild(variant: PluginSource): PackageBuild {
  return { version: variant.version, fingerprint: variant.fingerprint }
}

// A copy whose source was never recorded keeps the plain catalog pick, with the plugin's own version as
// the last resort, exactly as every surface read it before provenance was recorded.
function catalogPickBuild(plugin: Plugin, installed: InstalledOnPrinter): PackageBuild {
  const ceiling = (installed.ceilingFor ?? ALLOW_ALL_CHANNELS)(plugin.id)
  const variant = effectiveVariant(plugin, ceiling, installed.disabledChannels ?? [])

  return variant ? variantBuild(variant) : { version: plugin.version }
}

function offeredBuild(plugin: Plugin, installed: InstalledOnPrinter): PackageBuild | undefined {
  if (!installed.sources?.[plugin.id]) return catalogPickBuild(plugin, installed)
  const variant = updateVariant(plugin, installed)

  return variant && variantBuild(variant)
}

// The build this plugin would be updated TO, or undefined when there is no update to offer: the same
// fingerprint, nothing its source publishes within the ceiling, or the plugin is not on the printer at
// all. Without fingerprints on both sides, an installed version ahead of what its source offers is not
// an update (no downgrade prompts).
export function updateTargetBuild(plugin: Plugin, installed: InstalledOnPrinter): PackageBuild | undefined {
  const onPrinter = installed.versions[plugin.id]
  if (!onPrinter) return undefined
  const offered = offeredBuild(plugin, installed)
  if (!offered) return undefined
  const printerBuild = { version: onPrinter, fingerprint: installed.fingerprints?.[plugin.id] }

  return isUpdateOffered(printerBuild, offered, 'release') ? offered : undefined
}

export function updateTargetVersion(plugin: Plugin, installed: InstalledOnPrinter): string | undefined {
  return updateTargetBuild(plugin, installed)?.version
}

export function hasUpdate(plugin: Plugin, installed: InstalledOnPrinter): boolean {
  return updateTargetVersion(plugin, installed) !== undefined
}

// How many plugins on this printer have an update waiting (the header dropdown's count). The ceiling
// defaults to allow-all (the absolute-newest variant) for callers that do not thread the real ceiling.
export function pluginUpdateCount(printer: Printer, plugins: Plugin[], ceilingFor: CeilingResolver = ALLOW_ALL_CHANNELS, disabledChannels: ReleaseChannel[] = []): number {
  const installed = installedOnPrinter(printer, ceilingFor, disabledChannels)

  return plugins.filter((plugin) => hasUpdate(plugin, installed)).length
}
