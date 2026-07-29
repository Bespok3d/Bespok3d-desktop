// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, afterEach } from 'vitest'
// @ts-expect-error - build-time generator, plain JS with no type declarations
import { buildIndex, variantSources, devBuildTag } from '../../../../../scripts/app-bundle.mjs'

const SAMPLE_MANIFESTS = [
  {
    name: 'camera-hw-accel',
    title: 'Camera HW Accel',
    version: '0.2.0',
    description: 'Camera streaming.',
    tagline: 'Stream cameras.',
    category: 'camera',
    channel: 'lts',
    publisher: 'PLACEHOLDER',
    printer_specific: true,
    published_at: '2025-08-14',
    updated_at: '2026-04-22',
    provides: ['camera-service'],
    depends: ['base@>=1.0'],
    conflicts: [],
    requires: { capabilities: ['rockchip-mpp'] },
    endpoints: [{ label: 'Camera 1', path: '/webcam/' }],
  },
  {
    name: 'webcam-builtin',
    title: 'Built-in Camera',
    version: '0.1.0',
    description: 'Built-in camera entry.',
    tagline: 'Built-in camera.',
    category: 'camera',
    channel: 'stable',
    publisher: 'PLACEHOLDER',
    printer_specific: true,
    published_at: '2025-11-03',
    updated_at: '2026-01-15',
    min_daemon_version: '0.10.1-dev',
    icon: 'https://example.com/webcam.png',
    changelog: 'doc/CHANGELOG.md',
    provides: ['webcam-builtin'],
    depends: ['base@>=1.0', 'camera-service@>=1.0'],
    conflicts: [],
    requires: { capabilities: ['camera-mipi'] },
    config: [{ key: 'BUILTIN_CAMERA_NAME', label: 'Name', type: 'text' }],
    endpoints: [],
  },
]

function byName(plugins: Array<{ name: string }>, name: string) {
  return plugins.find((plugin) => plugin.name === name) as Record<string, unknown>
}

describe('buildIndex envelope', () => {
  const index = buildIndex(SAMPLE_MANIFESTS)

  it('produces the federated index envelope', () => {
    expect(index.schema_version).toBe(1)
    expect(index.name).toBe('Bespok3d Official')
    expect(index.lists).toEqual([])
    expect(index.plugins).toHaveLength(2)
  })

  it('sets updated to the latest plugin updated_at', () => {
    expect(index.updated).toBe('2026-04-22')
  })

  it('sorts plugins by name', () => {
    expect(index.plugins.map((plugin: { name: string }) => plugin.name)).toEqual([
      'camera-hw-accel',
      'webcam-builtin',
    ])
  })
})

describe('buildIndex entry fields', () => {
  const index = buildIndex(SAMPLE_MANIFESTS)
  const camera = byName(index.plugins, 'camera-hw-accel')
  const webcam = byName(index.plugins, 'webcam-builtin')

  it('carries the catalog title through to the entry', () => {
    expect(camera.title).toBe('Camera HW Accel')
  })

  it('derives store deps from the service graph, dropping base', () => {
    expect(webcam.deps).toEqual(['camera-hw-accel'])
  })

  it('builds a disk-relative download_url from name and version', () => {
    expect(camera.download_url).toBe('camera-hw-accel-0.2.0.b3')
  })

  it('omits empty endpoints and absent optional fields', () => {
    expect(webcam.endpoints).toBeUndefined()
    expect(camera.endpoints).toHaveLength(1)
    expect(webcam.min_daemon_version).toBe('0.10.1-dev')
    expect(camera.min_daemon_version).toBeUndefined()
  })
})

const SERVICE_MODEL_MANIFESTS = [
  {
    name: 'rfid-ntag',
    title: 'RFID',
    version: '0.1.1',
    description: 'RFID reader.',
    tagline: 'RFID.',
    category: 'filament',
    channel: 'lts',
    publisher: 'PLACEHOLDER',
    printer_specific: true,
    published_at: '2025-09-02',
    updated_at: '2026-05-31',
    provides: [{ service: 'rfid-service' }],
    require: [],
    conflicts: [],
    requires: { capabilities: ['rfid-spi'] },
  },
  {
    name: 'spoolman',
    title: 'Spoolman',
    version: '0.1.4',
    description: 'Spool tracking.',
    tagline: 'Spoolman.',
    category: 'filament',
    channel: 'stable',
    publisher: 'PLACEHOLDER',
    printer_specific: false,
    published_at: '2025-09-20',
    updated_at: '2026-05-31',
    provides: [{ service: 'spoolman-service' }],
    require: [{ service: 'rfid-service', cardinality: 'one' }],
    conflicts: [],
    requires: { capabilities: ['klipper-generic'] },
  },
]

describe('buildIndex service model', () => {
  const index = buildIndex(SERVICE_MODEL_MANIFESTS)
  const spoolman = byName(index.plugins, 'spoolman')

  it('resolves a require selector to the providing plugin id', () => {
    expect(spoolman.deps).toEqual(['rfid-ntag'])
  })

  it('emits provides as bare service-name strings', () => {
    expect(spoolman.provides).toEqual(['spoolman-service'])
  })
})

const LOG_MANIFESTS = [
  {
    name: 'octoeverywhere',
    title: 'OctoEverywhere',
    version: '0.1.0',
    description: 'Remote access.',
    tagline: 'Remote access.',
    category: 'system',
    channel: 'experiment',
    publisher: 'PLACEHOLDER',
    printer_specific: false,
    published_at: '2026-06-09',
    updated_at: '2026-06-09',
    provides: [{ service: 'octoeverywhere' }],
    require: [],
    conflicts: [],
    requires: { capabilities: ['klipper-generic'] },
    install: { service: [{ name: 'octoeverywhere' }] },
  },
  {
    name: 'status-feed',
    title: 'Status Feed',
    version: '0.1.0',
    description: 'Status feed.',
    tagline: 'Status feed.',
    category: 'system',
    channel: 'experiment',
    publisher: 'PLACEHOLDER',
    printer_specific: false,
    published_at: '2026-06-09',
    updated_at: '2026-06-09',
    provides: [{ service: 'status-feed' }],
    require: [],
    conflicts: [],
    requires: { capabilities: ['klipper-generic'] },
    install: { service: [{ name: 'status-feed' }] },
    log: { path: 'var/status/feed.log', captures: { token: 'tok_[a-z0-9]+' } },
  },
  {
    name: 'cpu-temp',
    title: 'CPU Temp',
    version: '0.1.0',
    description: 'CPU sensor.',
    tagline: 'CPU sensor.',
    category: 'sensors',
    channel: 'stable',
    publisher: 'PLACEHOLDER',
    printer_specific: true,
    published_at: '2026-01-01',
    updated_at: '2026-01-01',
    provides: [{ service: 'cpu-temp' }],
    require: [],
    conflicts: [],
    requires: { capabilities: ['klipper-generic'] },
  },
]

describe('buildIndex log source', () => {
  const index = buildIndex(LOG_MANIFESTS)
  const oe = byName(index.plugins, 'octoeverywhere')
  const statusFeed = byName(index.plugins, 'status-feed')
  const cpuTemp = byName(index.plugins, 'cpu-temp')

  it('emits an empty log marker for a managed-service plugin (defaults to the wrapper log)', () => {
    expect(oe.log).toEqual({})
  })

  it('carries an explicit log block (path + named captures) through', () => {
    expect(statusFeed.log).toEqual({ path: 'var/status/feed.log', captures: { token: 'tok_[a-z0-9]+' } })
  })

  it('omits log when the plugin declares no service and no log block', () => {
    expect(cpuTemp.log).toBeUndefined()
  })
})

describe('buildIndex browse-without-download fields', () => {
  const index = buildIndex(SAMPLE_MANIFESTS)
  const camera = byName(index.plugins, 'camera-hw-accel')
  const webcam = byName(index.plugins, 'webcam-builtin')

  it('always emits a doc_url so the detail page renders without the .b3', () => {
    index.plugins.forEach((plugin: { name: string; doc_url: string }) => {
      expect(plugin.doc_url).toBe(`${plugin.name}/doc/README.md`)
    })
  })

  it('emits changelog_url only when the manifest declares a changelog', () => {
    expect(webcam.changelog_url).toBe('webcam-builtin/doc/CHANGELOG.md')
    expect(camera.changelog_url).toBeUndefined()
  })

  it('copies an explicit icon through and omits it otherwise', () => {
    expect(webcam.icon).toBe('https://example.com/webcam.png')
    expect(camera.icon).toBeUndefined()
  })
})

const AUTHORED_MANIFESTS = [
  {
    name: 'fluidd',
    title: 'Fluidd',
    version: '0.1.4',
    description: 'Modern Fluidd.',
    tagline: 'Modern Fluidd.',
    category: 'ui',
    channel: 'stable',
    publisher: 'PLACEHOLDER',
    author: 'bespoked',
    sw_version: '1.37.2',
    printer_specific: true,
    published_at: '2026-07-02',
    updated_at: '2026-07-02',
    provides: [{ service: 'fluidd-ui' }],
    require: [],
    conflicts: [],
    requires: { capabilities: ['klipper-generic'] },
  },
  {
    kind: 'collection',
    name: 'all-the-tags',
    title: 'All the Tags',
    version: '0.1.0',
    description: 'The whole RFID tag stack.',
    tagline: 'Every spool, identified.',
    category: 'filament',
    channel: 'experiment',
    publisher: 'PLACEHOLDER',
    author: 'bespoked',
    printer_specific: false,
    published_at: '2026-06-30',
    updated_at: '2026-06-30',
    members: [{ id: 'spoolman', version: '>=0.1.4' }],
  },
]

describe('buildIndex author + sw_version', () => {
  const index = buildIndex(AUTHORED_MANIFESTS)
  const fluidd = byName(index.plugins, 'fluidd')
  const collection = index.collections[0]

  it('copies author and sw_version onto a plugin that carries them', () => {
    expect(fluidd.author).toBe('bespoked')
    expect(fluidd.sw_version).toBe('1.37.2')
  })

  it('copies author onto a collection (a collection carries no sw_version)', () => {
    expect(collection.author).toBe('bespoked')
    expect(collection.sw_version).toBeUndefined()
  })

  it('omits author and sw_version when the manifest carries neither', () => {
    const plain = byName(buildIndex(SAMPLE_MANIFESTS).plugins, 'camera-hw-accel')
    expect(plain.author).toBeUndefined()
    expect(plain.sw_version).toBeUndefined()
  })
})

const COLLECTION_MANIFESTS = [
  {
    name: 'spoolman',
    title: 'Spoolman',
    version: '0.1.4',
    description: 'Spool tracking.',
    tagline: 'Spoolman.',
    category: 'filament',
    channel: 'stable',
    publisher: 'PLACEHOLDER',
    printer_specific: false,
    published_at: '2025-09-20',
    updated_at: '2026-05-31',
    provides: [{ service: 'spoolman-service' }],
    require: [],
    conflicts: [],
    requires: { capabilities: ['klipper-generic'] },
  },
  {
    kind: 'collection',
    name: 'all-the-tags',
    title: 'All the Tags',
    version: '0.1.0',
    description: 'The whole RFID tag stack.',
    tagline: 'Every spool, identified.',
    category: 'filament',
    channel: 'experiment',
    publisher: 'PLACEHOLDER',
    printer_specific: false,
    published_at: '2026-06-30',
    updated_at: '2026-06-30',
    changelog: 'doc/CHANGELOG.md',
    members: [
      { id: 'rfid-ntag', version: '>=0.1.6' },
      { id: 'spoolman', version: '>=0.1.4' },
    ],
  },
]

describe('buildIndex collections', () => {
  const index = buildIndex(COLLECTION_MANIFESTS)
  const collection = index.collections[0]

  it('emits a kind:collection manifest into collections[], not plugins[]', () => {
    expect(index.plugins.map((plugin: { name: string }) => plugin.name)).toEqual(['spoolman'])
    expect(index.collections).toHaveLength(1)
    expect(collection.name).toBe('all-the-tags')
  })

  it('carries members verbatim and a resolvable doc_url', () => {
    expect(collection.members).toEqual([
      { id: 'rfid-ntag', version: '>=0.1.6' },
      { id: 'spoolman', version: '>=0.1.4' },
    ])
    expect(collection.doc_url).toBe('all-the-tags/doc/README.md')
  })

  it('omits any .b3 resolution and dependency fields a collection must never carry', () => {
    expect(collection.download_url).toBeUndefined()
    expect(collection.content_hash).toBeUndefined()
    expect(collection.deps).toBeUndefined()
    expect(collection.provides).toBeUndefined()
    expect(collection.requires).toBeUndefined()
  })

  it('emits changelog_url only when the manifest declares a changelog', () => {
    expect(collection.changelog_url).toBe('all-the-tags/doc/CHANGELOG.md')
  })

  it('folds the collection updated_at into the envelope updated', () => {
    expect(index.updated).toBe('2026-06-30')
  })

  it('always emits a collections[] slot, even with no collections', () => {
    expect(buildIndex(SAMPLE_MANIFESTS).collections).toEqual([])
  })
})

function joinPath(...parts: string[]): string {
  return parts.join('/')
}

function fakeFs(files: Record<string, string>, builtDirs: Set<string>) {
  function readFile(path: string): Promise<string> {
    return path in files ? Promise.resolve(files[path]) : Promise.reject(new Error(`no such file: ${path}`))
  }
  function stat(path: string): Promise<{ isDirectory: () => boolean }> {
    return builtDirs.has(path) ? Promise.resolve({ isDirectory: () => true }) : Promise.reject(new Error('ENOENT'))
  }

  return { readFile, stat }
}

const VARIANT_PLUGINS = '/repo/plugins'
const VARIANT_SCRIPTS = '/repo/scripts'
const FLUIDD_DIR = `${VARIANT_PLUGINS}/fluidd-plugin/fluidd-bleeding-edge`
const MAINSAIL_DIR = `${VARIANT_PLUGINS}/mainsail-plugin/mainsail-bleeding-edge`
const BUNDLE_DEV = JSON.stringify({
  variantDirs: ['fluidd-plugin/fluidd-bleeding-edge', 'mainsail-plugin/mainsail-bleeding-edge'],
})
const VARIANT_FILES = {
  [`${VARIANT_SCRIPTS}/bundle.dev.json`]: BUNDLE_DEV,
  [`${FLUIDD_DIR}/manifest.json`]: JSON.stringify({ name: 'fluidd', version: '0.2.0-experiment', channel: 'experiment' }),
  [`${MAINSAIL_DIR}/manifest.json`]: JSON.stringify({ name: 'mainsail', version: '0.2.0-experiment', channel: 'experiment' }),
}

function sourceNames(sources: Array<{ name: string }>): string[] {
  return sources.map((source) => source.name)
}

describe('devBuildTag (dev-only build metadata)', () => {
  const files = [
    { path: 'extras/AFC.py', bytes: Buffer.from('print("a")') },
    { path: 'extras/AFC_lane.py', bytes: Buffer.from('print("b")') },
  ]

  it('is stable for identical files and order-independent', () => {
    expect(devBuildTag(files)).toBe(devBuildTag([...files].reverse()))
  })

  it('is shaped as semver build metadata +dev.<hash8>', () => {
    expect(devBuildTag(files)).toMatch(/^\+dev\.[0-9a-f]{8}$/)
  })

  it('changes when a byte changes', () => {
    const edited = [files[0], { path: 'extras/AFC_lane.py', bytes: Buffer.from('print("c")') }]
    expect(devBuildTag(edited)).not.toBe(devBuildTag(files))
  })
})

describe('buildIndex with dev build-tags', () => {
  const buildTags = { 'camera-hw-accel@0.2.0': '+dev.3a7f1c2a' }
  const index = buildIndex(SAMPLE_MANIFESTS, buildTags)
  const camera = byName(index.plugins, 'camera-hw-accel')
  const webcam = byName(index.plugins, 'webcam-builtin')

  it('appends the build-tag to the displayed version of a tagged atom only', () => {
    expect(camera.version).toBe('0.2.0+dev.3a7f1c2a')
    expect(webcam.version).toBe('0.1.0')
  })

  it('keeps the download_url on the clean manifest version (the packed .b3 filename)', () => {
    expect(camera.download_url).toBe('camera-hw-accel-0.2.0.b3')
  })
})

const CHANNEL_ATOM_MANIFESTS = [
  {
    name: 'fluidd',
    title: 'Fluidd',
    version: '0.1.3',
    description: 'Modern Fluidd, stable channel.',
    tagline: 'Modern Fluidd.',
    category: 'ui',
    channel: 'stable',
    publisher: 'PLACEHOLDER',
    printer_specific: true,
    published_at: '2025-10-12',
    updated_at: '2026-07-02',
    provides: [{ service: 'fluidd-ui' }],
    require: [],
    conflicts: [],
    requires: { capabilities: ['klipper-generic'] },
  },
  {
    name: 'fluidd',
    title: 'Fluidd (bleeding edge)',
    version: '0.2.0-experiment',
    description: 'Upstream feature branch build.',
    tagline: 'Bleeding-edge Fluidd.',
    category: 'ui',
    channel: 'experiment',
    publisher: 'PLACEHOLDER',
    printer_specific: true,
    published_at: '2026-06-20',
    updated_at: '2026-06-20',
    provides: [{ service: 'fluidd-ui' }],
    require: [],
    conflicts: [],
    requires: { capabilities: ['klipper-generic'] },
  },
]

describe('buildIndex multi-atom ids (a stable atom beside a dev channel variant)', () => {
  const index = buildIndex(CHANNEL_ATOM_MANIFESTS, { 'fluidd@0.2.0-experiment': '+dev.1234abcd' })
  function byChannel(channel: string) {
    return index.plugins.find((plugin: { channel: string }) => plugin.channel === channel)
  }

  it('emits every channel atom of the id, neither shadowing the other', () => {
    expect(index.plugins).toHaveLength(2)
    expect(byChannel('stable')).toBeDefined()
    expect(byChannel('experiment')).toBeDefined()
  })

  it('applies a build-tag only to the atom it is keyed to, never to the same-id sibling', () => {
    expect(byChannel('stable').version).toBe('0.1.3')
    expect(byChannel('experiment').version).toBe('0.2.0-experiment+dev.1234abcd')
  })

  it('resolves each atom download_url from its own clean version', () => {
    expect(byChannel('stable').download_url).toBe('fluidd-0.1.3.b3')
    expect(byChannel('experiment').download_url).toBe('fluidd-0.2.0-experiment.b3')
  })

  it('rejects two atoms sharing name and version (one would silently shadow the other)', () => {
    const duplicated = [CHANNEL_ATOM_MANIFESTS[0], { ...CHANNEL_ATOM_MANIFESTS[0] }]
    expect(() => buildIndex(duplicated)).toThrow(/duplicate atoms.*fluidd@0\.1\.3/)
  })
})

describe('variantSources (dev-only channel variants)', () => {
  afterEach(() => {
    delete process.env.B3D_INCLUDE_DEV_BUNDLE
  })

  it('returns nothing when the dev bundle is not requested', async () => {
    const { readFile, stat } = fakeFs(VARIANT_FILES, new Set())
    expect(await variantSources(readFile, stat, joinPath, VARIANT_PLUGINS, VARIANT_SCRIPTS)).toEqual([])
  })

  it('sources built variants as same-id experiment atoms and skips unbuilt ones', async () => {
    process.env.B3D_INCLUDE_DEV_BUNDLE = '1'
    const { readFile, stat } = fakeFs(VARIANT_FILES, new Set([`${FLUIDD_DIR}/files`]))
    const sources = await variantSources(readFile, stat, joinPath, VARIANT_PLUGINS, VARIANT_SCRIPTS)
    expect(sourceNames(sources)).toEqual(['fluidd'])
    expect(sources[0]).toMatchObject({ dir: FLUIDD_DIR, manifest: { channel: 'experiment', version: '0.2.0-experiment' } })
  })

  it('sources every built variant when all are built', async () => {
    process.env.B3D_INCLUDE_DEV_BUNDLE = '1'
    const { readFile, stat } = fakeFs(VARIANT_FILES, new Set([`${FLUIDD_DIR}/files`, `${MAINSAIL_DIR}/files`]))
    const sources = await variantSources(readFile, stat, joinPath, VARIANT_PLUGINS, VARIANT_SCRIPTS)
    expect(sourceNames(sources)).toEqual(['fluidd', 'mainsail'])
  })
})
