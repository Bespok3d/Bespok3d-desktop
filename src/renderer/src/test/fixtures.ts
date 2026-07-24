import type { Plugin, PluginSource, IndexEntry, CatalogPayload } from '../data/types'
import type { Collection, CollectionEntry } from '../data/collections'
import type { Printer } from '../data/types'
import type { Catalog } from '../env'
import type { KeyRecord } from '../data/keyTypes'

const OFFICIAL_URL = 'github:Bespok3d/main-index/index.json'

export function makeSource(overrides: Partial<PluginSource> = {}): PluginSource {
  return {
    registryUrl: OFFICIAL_URL, label: 'Bespok3d Official', version: '1.0.0', channel: 'stable',
    trust: 'project', local: false, downloadUrl: 'github:Bespok3d/demo/demo-1.0.0.b3',
    ...overrides,
  }
}

export function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    id: 'demo', name: 'demo', title: 'Demo Plugin', category: 'tuning',
    tagline: 'A demo plugin', description: 'A demo plugin for tests', version: '1.0.0',
    channel: 'stable', publisher: 'Bespok3d', signer: 'Bespok3d', trust: 'project', deps: [], conflicts: [],
    sources: [makeSource()],
    ...overrides,
  }
}

export function makeIndexEntry(overrides: Partial<IndexEntry> = {}): IndexEntry {
  return {
    name: 'demo', title: 'Demo Plugin', version: '1.0.0', description: 'A demo plugin for tests',
    tagline: 'A demo plugin', category: 'tuning', channel: 'stable', publisher: 'Bespok3d',
    printer_specific: false, published_at: '2026-01-01', updated_at: '2026-01-01',
    requires: { capabilities: [] }, provides: [], deps: [], conflicts: [],
    doc_url: '', download_url: 'demo/demo-1.0.0.b3', trust: 'project', registry_url: OFFICIAL_URL,
    ...overrides,
  }
}

export function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'demo-collection', name: 'demo-collection', title: 'Demo Collection', category: 'tuning',
    tagline: 'A demo collection', description: 'A demo collection for tests', version: '1.0.0',
    channel: 'stable', publisher: 'Bespok3d', signer: 'Bespok3d', trust: 'project',
    members: [{ id: 'demo', version: '>=1.0.0' }],
    ...overrides,
  }
}

export function makeCollectionEntry(overrides: Partial<CollectionEntry> = {}): CollectionEntry {
  return {
    name: 'demo-collection', title: 'Demo Collection', version: '1.0.0',
    description: 'A demo collection for tests', tagline: 'A demo collection', category: 'tuning',
    channel: 'stable', publisher: 'Bespok3d', printer_specific: false,
    published_at: '2026-01-01', updated_at: '2026-01-01',
    members: [{ id: 'demo', version: '>=1.0.0' }],
    doc_url: 'demo-collection/doc/README.md', trust: 'project', registry_url: OFFICIAL_URL,
    ...overrides,
  }
}

export function makeCatalogPayload(plugins: IndexEntry[], overrides: Partial<CatalogPayload> = {}): CatalogPayload {
  return {
    name: 'Bespok3d Official', publisher: 'Bespok3d', updated: '2026-01-01', trust: 'project',
    plugins, collections: [], registries: [], sources: [], drops: [],
    ...overrides,
  }
}

// The over-the-wire catalog (what registry.catalog resolves to): the renderer payload plus the
// main-only `failures` list the trust boundary drops. The wire types plugins loosely (MergedEntry),
// so a test building them from the strict IndexEntry asserts across the same boundary toCatalogPayload
// crosses the other way.
export function makeCatalog(plugins: IndexEntry[], overrides: Partial<CatalogPayload> = {}): Catalog {
  return { ...makeCatalogPayload(plugins, overrides), failures: [] } as unknown as Catalog
}

export function makeCapabilities(installed: Record<string, string>, overrides: Partial<CapabilitiesResult> = {}): CapabilitiesResult {
  return {
    adapter: 'snapmaker-u1', hardware: [], installed, firmware_version: '1.4.0.246',
    arch: 'aarch64', board_class: 'standard',
    kernel: { release: '6.1.99', vermagic: '6.1.99 SMP preempt mod_unload aarch64' },
    klipper_version: 'v0.12.0', jinni_version: '0.1.1', capability_flags: [], interface_extras: [],
    preferred_registries: [], endpoints: [],
    ...overrides,
  }
}

export function makeInstallLog(pluginId: string): InstallLog {
  return { pluginId, timestamp: 1, ok: true, phases: [] }
}

export function makePrinter(overrides: Partial<Printer> = {}): Printer {
  return {
    id: 'printer-1', nick: 'Test Printer', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
    host: 'test.local', ip: '10.0.0.1', status: 'managed', installedIds: [],
    daemonVersion: '0.10.31-dev', firmwareVersion: '1.4.0.246', jinniVersion: '0.1.1',
    ...overrides,
  }
}

export function makeAdapterInfo(overrides: Partial<AdapterInfo> = {}): AdapterInfo {
  return {
    id: 'snapmaker-u1', title: 'Snapmaker U1', vendor: 'Snapmaker', version: '1.0.0', jinniVersion: '0.1.6',
    description: 'Snapmaker U1 adapter',
    defaults: { sshUser: 'root', sshPort: 22, sshPasswordHint: '', runtimeUser: 'lava' },
    envVars: [], enrollSteps: [],
    ...overrides,
  }
}

export function makeEnrollEvent(overrides: Partial<EnrollProgressEvent> = {}): EnrollProgressEvent {
  return {
    printerId: 'printer-1', stepId: 'preflight', stepLabel: 'Preflight', stepDetail: 'Checking',
    status: 'running', stepIndex: 0, totalSteps: 14, completedSteps: [],
    ...overrides,
  }
}

export function makeKey(overrides: Partial<KeyRecord> = {}): KeyRecord {
  return {
    id: 'key-1', label: 'My Key', isDefault: false, assignments: [], type: 'gpg-ed25519',
    fingerprint: 'ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234',
    fingerprintShort: 'ABCD1234', publicKey: 'ssh-ed25519 AAAA', addedAt: '2026-01-01',
    ...overrides,
  }
}
