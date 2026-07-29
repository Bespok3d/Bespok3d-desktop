// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Build the sideloaded source's index.json from the manifests of the dropped .b3 files. Produces the
// SAME entry shape as scripts/app-bundle.mjs buildIndexEntry (a drift test pins this), so a local
// package renders in the store exactly like a published one; trust + registry_url are injected by the
// resolver, not stored here.
import type { StoredManifest } from './b3-manifest'

const INDEX_SCHEMA_VERSION = 1
const LOCAL_REGISTRY_NAME = 'Sideloaded'
const LOCAL_REGISTRY_PUBLISHER = 'LOCAL'
const BASE_DEPENDENCY = 'base'

function serviceName(provided: unknown): string {
  return typeof provided === 'string' ? provided : (provided as { service: string }).service
}

function requiredServices(manifest: StoredManifest): string[] {
  const require = manifest.require as { service: string }[] | undefined
  if (require !== undefined) return require.map((entry) => entry.service)
  const depends = (manifest.depends as string[] | undefined) ?? []

  return depends.map((dependency) => dependency.split('@')[0]).filter((service) => service !== BASE_DEPENDENCY)
}

function providerByService(manifests: StoredManifest[]): Record<string, string> {
  const providers: Record<string, string> = {}
  manifests.forEach((manifest) => {
    ;((manifest.provides as unknown[]) ?? []).forEach((provided) => {
      const service = serviceName(provided)
      if (!(service in providers)) providers[service] = manifest.name
    })
  })

  return providers
}

function resolveStoreDeps(manifest: StoredManifest, providers: Record<string, string>): string[] {
  const resolved: string[] = []
  requiredServices(manifest).forEach((service) => {
    const providerId = providers[service] ?? service
    if (!resolved.includes(providerId)) resolved.push(providerId)
  })

  return resolved
}

function copyIfPresent(target: Record<string, unknown>, source: StoredManifest, keys: string[]): void {
  keys.forEach((key) => {
    if (source[key] !== undefined) target[key] = source[key]
  })
}

function buildLocalEntry(manifest: StoredManifest, providers: Record<string, string>): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    name: manifest.name,
    title: manifest.title ?? manifest.name,
    version: manifest.version,
    description: manifest.description ?? '',
    tagline: manifest.tagline ?? '',
    category: manifest.category ?? 'other',
    channel: manifest.channel ?? 'testing',
    publisher: manifest.publisher ?? LOCAL_REGISTRY_PUBLISHER,
    printer_specific: (manifest.printer_specific as boolean | undefined) ?? false,
    published_at: manifest.published_at ?? '',
    updated_at: manifest.updated_at ?? '',
    requires: { capabilities: (manifest.requires as { capabilities?: string[] } | undefined)?.capabilities ?? [] },
    provides: ((manifest.provides as unknown[]) ?? []).map(serviceName),
    deps: resolveStoreDeps(manifest, providers),
    conflicts: (manifest.conflicts as string[] | undefined) ?? [],
    doc_url: `${manifest.name}/doc/README.md`,
    download_url: `${manifest.name}-${manifest.version}.b3`,
  }
  copyIfPresent(entry, manifest, ['icon', 'min_daemon_version', 'homepage', 'macros', 'config', 'author', 'sw_version'])
  if (manifest.changelog) entry.changelog_url = `${manifest.name}/${manifest.changelog as string}`
  const endpoints = (manifest.endpoints as unknown[]) ?? []
  if (endpoints.length > 0) entry.endpoints = endpoints

  return entry
}

export function buildLocalIndex(manifests: StoredManifest[]): Record<string, unknown> {
  const sorted = [...manifests].sort((earlier, later) => earlier.name.localeCompare(later.name))
  const providers = providerByService(sorted)
  const plugins = sorted.map((manifest) => buildLocalEntry(manifest, providers))
  const updated = plugins.reduce<string>(
    (latest, plugin) => ((plugin.updated_at as string) > latest ? (plugin.updated_at as string) : latest),
    '',
  )

  return { schema_version: INDEX_SCHEMA_VERSION, name: LOCAL_REGISTRY_NAME, publisher: LOCAL_REGISTRY_PUBLISHER, updated, plugins, lists: [] }
}
