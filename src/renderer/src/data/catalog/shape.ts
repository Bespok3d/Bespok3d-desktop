// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, IndexEntry, CatalogPayload, Repository, PluginSource, SourceRow } from '../types'
import type { Collection, CollectionEntry } from '../collections'
import type { Catalog } from '../../env'
import { withExplicitScope } from '../plugin-config'

// The catalog is loaded from the generated index.json over IPC (data/catalog-context.tsx).
// This module is the single snake_case -> camelCase boundary: it maps each index entry to the
// Plugin shape the UI consumes. Doc and changelog Markdown plus their media stay bundled with
// the app build (a browsing client renders them without downloading the .b3), keyed by plugin
// id via import.meta.glob so adding a plugin needs no hand-maintained import list.
// Plugins live in the sibling plugins/ tree (the repo split). Docs are keyed by the plugin's
// manifest .name (its identity, matching app-bundle.mjs), not by its directory name: most dirs
// are named for the plugin, but some are not (e.g. u1-hw-camera/plugin).
const RAW_DOC_ASSETS = import.meta.glob(
  ['../../../../../../plugins/**/doc/**/*.{png,jpg,jpeg,gif,webp,svg,mp4,webm,mov}'],
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

const RAW_READMES = import.meta.glob(
  ['../../../../../../plugins/**/doc/README.md'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

const RAW_CHANGELOGS = import.meta.glob(
  ['../../../../../../plugins/**/doc/CHANGELOG.md'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

const RAW_MANIFESTS = import.meta.glob(
  ['../../../../../../plugins/**/manifest.json'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

// Map each plugin directory to the name its manifest declares, so docs key by identity (manifest
// .name) and not by a directory that may differ from it (e.g. u1-hw-camera/plugin -> camera-hw-accel).
const NAME_BY_DIR: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_MANIFESTS).flatMap(([absPath, content]) => {
    const dir = absPath.slice(0, absPath.lastIndexOf('/'))

    try {
      return [[dir, JSON.parse(content).name as string]]
    } catch {
      return []
    }
  }),
)

function pluginNameOf(docPath: string): string | undefined {
  return NAME_BY_DIR[docPath.replace(/\/doc\/.*$/, '')]
}

export const DOC_ASSETS: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_DOC_ASSETS).flatMap(([absPath, url]) => {
    const name = pluginNameOf(absPath)
    const sub = absPath.match(/\/doc\/(.+)$/)

    return name && sub ? [[`${name}/${sub[1]}`, url]] : []
  }),
)

function byPluginName(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).flatMap(([absPath, content]) => {
      const name = pluginNameOf(absPath)

      return name ? [[name, content]] : []
    }),
  )
}

const READMES = byPluginName(RAW_READMES)
const CHANGELOGS = byPluginName(RAW_CHANGELOGS)

export function docFor(pluginName: string): string | undefined {
  return READMES[pluginName]
}

export function changelogFor(pluginName: string): string | undefined {
  return CHANGELOGS[pluginName]
}

// A doc field carries whatever the publisher's build wrote there: a release asset URL when the docs
// travelled with the release, otherwise a source path or a link for a human to click. Only the asset
// form can be fetched (the app reads it through the release-asset API, with the token a private repo
// needs), so the rest is left to the bundled copy rather than shown as a broken page.
export function fetchableDocUrl(declared: string | undefined): string | undefined {
  return declared?.includes('/releases/assets/') ? declared : undefined
}

export function docAssetsFor(pluginId: string): Record<string, string> {
  const prefix = `${pluginId}/`

  return Object.fromEntries(
    Object.entries(DOC_ASSETS)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, url]) => [key.slice(prefix.length), url]),
  )
}

// A catalog entry is "local" when its source registry is the on-disk bundled dev index rather than
// a published list (github:/http url). Only dev builds include the local index as a source.
export function isLocalRegistry(registryUrl: string): boolean {
  return !/^(github:|https?:)/.test(registryUrl)
}

function entryToSource(variant: IndexEntry, labels: Record<string, string>): PluginSource {
  return {
    registryUrl: variant.registry_url,
    label: labels[variant.registry_url] ?? variant.registry_url,
    version: variant.version,
    swVersion: variant.sw_version,
    channel: variant.channel,
    trust: variant.trust,
    local: isLocalRegistry(variant.registry_url),
    publishedAt: variant.published_at,
    downloadUrl: variant.download_url,
  }
}

// The fields a Plugin and a Collection map identically from their wire entry: catalog identity,
// metadata, and the doc/changelog/local enrichment. Shared so the two mappers do not drift (and stay
// clone-free). Both wire types carry these fields, so the param is their structural union.
function entryToCatalogBase(entry: IndexEntry | CollectionEntry) {
  return {
    id: entry.name,
    name: entry.name,
    title: entry.title,
    category: entry.category,
    tagline: entry.tagline,
    description: entry.description,
    version: entry.version,
    channel: entry.channel,
    publisher: entry.publisher,
    author: entry.author,
    // A list that arrived unproved carries no signer, and that absence is the whole point: it is what
    // the store shows instead of the publisher line the list wrote about itself.
    signer: entry.signer ?? null,
    trust: entry.trust,
    printerSpecific: entry.printer_specific,
    publishedAt: entry.published_at,
    updatedAt: entry.updated_at,
    homepage: entry.homepage,
    doc: docFor(entry.name),
    docUrl: fetchableDocUrl(entry.doc_url),
    changelog: entry.changelog_url ? changelogFor(entry.name) : undefined,
    changelogUrl: fetchableDocUrl(entry.changelog_url),
    local: isLocalRegistry(entry.registry_url),
  }
}

function entryToPlugin(entry: IndexEntry, labels: Record<string, string>): Plugin {
  return {
    ...entryToCatalogBase(entry),
    swVersion: entry.sw_version,
    deps: entry.deps,
    conflicts: entry.conflicts,
    endpoints: entry.endpoints,
    // The one place a legacy field (no `scope` key) becomes the strict domain shape: every path
    // into the renderer (published lists, the bundled dev index, sideloaded local packages) rides
    // this mapper, so absence never propagates past the wire.
    config: entry.config?.map(withExplicitScope),
    minDaemonVersion: entry.min_daemon_version,
    macros: entry.macros,
    log: entry.log,
    sources: (entry.variants ?? [entry]).map((variant) => entryToSource(variant, labels)),
  }
}

function sourceLabels(sources: SourceRow[]): Record<string, string> {
  return Object.fromEntries(sources.map((source) => [source.url, source.label]))
}

export function indexToPlugins(entries: IndexEntry[], sources: SourceRow[]): Plugin[] {
  const labels = sourceLabels(sources)

  return entries.map((entry) => entryToPlugin(entry, labels))
}

// The collection snake_case -> camelCase boundary (the sibling of entryToPlugin). A collection has no
// source picker, so it carries no `variants`/`sources`; its README/changelog Markdown reuse the same
// doc globs as plugins (keyed by the collection's manifest .name).
function entryToCollection(entry: CollectionEntry): Collection {
  return {
    ...entryToCatalogBase(entry),
    members: entry.members ?? [],
    icon: entry.icon,
  }
}

export function indexToCollections(entries: CollectionEntry[]): Collection[] {
  return entries.map(entryToCollection)
}

// The trust boundary between the wire and the renderer's domain. The main-process resolver relays the
// published index untyped (MergedEntry is name + version + passthrough, so one unreachable list never
// breaks the merge), so here, at the single point the catalog enters the renderer, we assert the
// ADR-0012 entry schema and drop the main-only `failures` field the UI does not consume.
export function toCatalogPayload(wire: Catalog): CatalogPayload {
  return {
    name: wire.name,
    publisher: wire.publisher,
    updated: wire.updated,
    trust: wire.trust,
    plugins: wire.plugins as unknown as IndexEntry[],
    collections: wire.collections as unknown as CollectionEntry[],
    registries: wire.registries,
    sources: wire.sources,
    drops: wire.drops,
  }
}

export function payloadToRegistry(payload: CatalogPayload): Repository {
  const primary = payload.registries[0]

  return {
    id: 'bundled',
    name: payload.name,
    url: primary?.url ?? 'bundled',
    trust: payload.trust,
    enabled: true,
    locked: primary?.locked ?? true,
    lastSync: '',
    pluginCount: payload.plugins.length,
    note: '',
  }
}
