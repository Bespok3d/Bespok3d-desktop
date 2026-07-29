// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Combine the entries gathered from every fetched registry into the one catalog the store shows:
// rank by trust then version, collapse a plugin that appears in several lists to one winner (carrying
// its source variants), and remap a dep that leaked through as a raw service name to its provider id.
import type { MergedCollection, MergedEntry, RegistryTrust } from '../model'

const TRUST_RANK: Record<RegistryTrust, number> = { manufacturer: 3, project: 2, community: 1, any: 0, unknown: -1 }

interface Rankable {
  name: string
  trust: RegistryTrust
  version: string
}

function versionRank(version: string): number {
  const core = version.split('-', 1)[0]
  const [major = 0, minor = 0, patch = 0] = core.split('.').map((part) => parseInt(part, 10) || 0)

  return major * 1_000_000 + minor * 1_000 + patch
}

function winsOver(candidate: Rankable, current: Rankable): boolean {
  const trustDelta = TRUST_RANK[candidate.trust] - TRUST_RANK[current.trust]
  if (trustDelta !== 0) return trustDelta > 0

  return versionRank(candidate.version) > versionRank(current.version)
}

// Cross-list dedupe (ADR-0012): the same id in several lists collapses to the latest version from
// the highest-trust source, preserving first-seen catalog order. Shared by plugins and collections,
// each deduped in its OWN id namespace so the two never collide.
function dedupeByName<EntryType extends Rankable>(entries: EntryType[]): EntryType[] {
  const winners = entries.reduce((chosen, entry) => {
    const current = chosen.get(entry.name)
    if (!current || winsOver(entry, current)) chosen.set(entry.name, entry)

    return chosen
  }, new Map<string, EntryType>())

  return [...winners.values()]
}

export function dedupeEntries(entries: MergedEntry[]): MergedEntry[] {
  return dedupeByName(entries)
}

// Collections never collapse into source-picker variants like plugins; they dedupe by collection id
// to one highest-trust-newest winner, in a namespace separate from plugin names.
export function dedupeCollections(entries: MergedCollection[]): MergedCollection[] {
  return dedupeByName(entries)
}

function groupByName(entries: MergedEntry[]): Map<string, MergedEntry[]> {
  return entries.reduce((groups, entry) => {
    groups.set(entry.name, [...(groups.get(entry.name) ?? []), entry])

    return groups
  }, new Map<string, MergedEntry[]>())
}

function variantOrder(left: MergedEntry, right: MergedEntry): number {
  if (winsOver(left, right)) return -1
  if (winsOver(right, left)) return 1

  return 0
}

function sortVariants(group: MergedEntry[]): MergedEntry[] {
  return [...group].sort(variantOrder)
}

// One grid entry per plugin name (first-seen order, highest-trust-newest winner), each carrying
// the full set of source variants so the detail view can let the user pick a source.
export function collapseToVariants(entries: MergedEntry[]): MergedEntry[] {
  return [...groupByName(entries).values()].map((group) => {
    const ranked = sortVariants(group)

    return { ...ranked[0], variants: ranked }
  })
}

function providedServices(entry: MergedEntry): string[] {
  return Array.isArray(entry.provides) ? (entry.provides as string[]) : []
}

// service name -> the plugin id that provides it, across the whole merged catalog (first provider
// wins). Lets a dep that leaked through as a raw service name (its provider lives in another source,
// so the per-source index builder could not resolve it) be mapped to the real plugin id at runtime.
function serviceProviderMap(entries: MergedEntry[]): Map<string, string> {
  return entries.reduce((providers, entry) => {
    providedServices(entry).forEach((service) => {
      if (!providers.has(service)) providers.set(service, entry.name)
    })

    return providers
  }, new Map<string, string>())
}

function entryDeps(entry: MergedEntry): string[] {
  return Array.isArray(entry.deps) ? (entry.deps as string[]) : []
}

// Rewrite each entry's store deps so a service-name dep maps to its provider plugin id. A dep that
// is already a known plugin id is kept; an unresolvable one is left untouched (install errors on it
// truthfully). Idempotent: a same-source dep already resolved at build time passes through.
export function resolveCrossSourceDeps(entries: MergedEntry[]): MergedEntry[] {
  const pluginIds = new Set(entries.map((entry) => entry.name))
  const serviceProviders = serviceProviderMap(entries)
  function remap(dep: string): string {
    return pluginIds.has(dep) ? dep : serviceProviders.get(dep) ?? dep
  }

  return entries.map((entry) => ({ ...entry, deps: [...new Set(entryDeps(entry).map(remap))] }))
}
