// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, PluginSource, Printer, ReleaseChannel } from '../types'
import { isNewerVersion, isUpdateOffered, parseSemanticVersion, sameVersion } from '@bespok3d/contract'
import type { PackageBuild } from '@bespok3d/contract'
import { effectiveVariant, ALLOW_ALL_CHANNELS } from './index'
import type { CeilingResolver } from './index'
import { isLocalRegistry } from '../catalog/local-source'

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

// The plugin as only the installed copy's own list offers it, with no sources when that list dropped it.
function pluginAsOwnList(plugin: Plugin, installedSource: string): Plugin {
  return { ...plugin, sources: (plugin.sources ?? []).filter((source) => source.registryUrl === installedSource) }
}

// The plugin narrowed to the source a locally built copy came from, so it is never replaced by the
// published copy that happens to carry a higher number. A recorded source the catalog no longer carries
// (a sideloaded .b3 that is gone) leaves the whole plugin, so the copy can still be updated from
// wherever it is offered now.
function pluginAsItsInstalledSource(plugin: Plugin, installedSource: string): Plugin {
  const ownList = pluginAsOwnList(plugin, installedSource)

  return ownList.sources.length === 0 ? plugin : ownList
}

// The plugin as the other published lists offer it: every list that is on except the installed copy's
// own. A build held on this machine is never among them, so a published copy is never replaced by it.
function pluginAsOtherLists(plugin: Plugin, installedSource: string): Plugin {
  const otherLists = (plugin.sources ?? []).filter((source) => source.registryUrl !== installedSource && !isLocalRegistry(source.registryUrl))

  return { ...plugin, sources: otherLists }
}

function isPrerelease(version: string): boolean {
  return parseSemanticVersion(version).prereleaseLabel !== null
}

// The same version, as the release flow publishes it: a prerelease list names a build `0.1.9-pre`, and
// the live list names its release of that version `0.1.9`. Moving from the first to the second is the
// switch back to the live copy.
export function isReleaseOfPrerelease(installedVersion: string, offeredVersion: string): boolean {
  return sameVersion(installedVersion, offeredVersion) && isPrerelease(installedVersion) && !isPrerelease(offeredVersion)
}

// The newer of the two picks by release; the installed copy's own list wins a tie.
function newerPick(ownPick: PluginSource | undefined, otherListsPick: PluginSource | undefined): PluginSource | undefined {
  if (!ownPick || !otherListsPick) return ownPick ?? otherListsPick

  return isNewerVersion(otherListsPick.version, ownPick.version) ? otherListsPick : ownPick
}

// The live release of the installed prerelease, on another list, within the ceiling.
function releaseOfInstalled(otherLists: Plugin, installedVersion: string, ceiling: ReleaseChannel, disabledChannels: ReleaseChannel[]): PluginSource | undefined {
  const releases = otherLists.sources.filter((source) => isReleaseOfPrerelease(installedVersion, source.version))

  return effectiveVariant({ ...otherLists, sources: releases }, ceiling, disabledChannels)
}

// A published copy is offered a newer release from any list that is on: its own list first on a tie,
// then the live release of the prerelease it runs, then whatever its own list offers (a rebuild). A list
// that dropped the plugin offers nothing; the other published lists stand in for it, and a build held
// on this machine never does.
function publishedCopyVariant(plugin: Plugin, installed: InstalledOnPrinter, installedSource: string): PluginSource | undefined {
  const ceiling = (installed.ceilingFor ?? ALLOW_ALL_CHANNELS)(plugin.id)
  const disabledChannels = installed.disabledChannels ?? []
  const installedVersion = installed.versions[plugin.id] ?? ''
  const otherLists = pluginAsOtherLists(plugin, installedSource)
  const ownPick = effectiveVariant(pluginAsOwnList(plugin, installedSource), ceiling, disabledChannels)
  const newest = newerPick(ownPick, effectiveVariant(otherLists, ceiling, disabledChannels))
  if (newest && isNewerVersion(newest.version, installedVersion)) return newest

  return releaseOfInstalled(otherLists, installedVersion, ceiling, disabledChannels) ?? ownPick
}

// The variant an update to this plugin would install, within the user's ceiling. A copy from a
// published list is offered the newest release of every list that is on (publishedCopyVariant). A copy
// built on this machine is only offered a newer build from the same place, and a copy whose source was
// never recorded keeps the plain catalog pick. Undefined when nothing within the ceiling is offered.
export function updateVariant(plugin: Plugin, installed: InstalledOnPrinter): PluginSource | undefined {
  const ceiling = (installed.ceilingFor ?? ALLOW_ALL_CHANNELS)(plugin.id)
  const installedSource = installed.sources?.[plugin.id]
  if (installedSource && !isLocalRegistry(installedSource)) return publishedCopyVariant(plugin, installed, installedSource)
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
// fingerprint, nothing offered within the ceiling, or the plugin is not on the printer at all. Without
// fingerprints on both sides, an installed version ahead of what is offered is not an update (no
// downgrade prompts). The live release of an installed prerelease is offered whatever the fingerprints
// say: the two are separate builds of the same version. That holds only for a copy whose source is
// recorded, the one path where the offer is always a real variant within the ceiling, never the
// plugin's own version as a stand-in.
export function updateTargetBuild(plugin: Plugin, installed: InstalledOnPrinter): PackageBuild | undefined {
  const onPrinter = installed.versions[plugin.id]
  if (!onPrinter) return undefined
  const offered = offeredBuild(plugin, installed)
  if (!offered) return undefined
  const printerBuild = { version: onPrinter, fingerprint: installed.fingerprints?.[plugin.id] }
  if (installed.sources?.[plugin.id] && isReleaseOfPrerelease(onPrinter, offered.version)) return offered

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
