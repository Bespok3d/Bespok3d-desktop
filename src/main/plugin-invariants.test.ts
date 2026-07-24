import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGINS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../plugins')
const SKIP_DIRS = new Set(['files', 'doc', 'dist', 'node_modules', '.git', '.github', 'scripts'])

interface Variant {
  src?: string
  diff?: string
}

interface Placement {
  class: string
  src?: string
  variants?: Variant[]
}

interface Instrumentation {
  class: string
  name: string
  diff?: string
  variants?: Variant[]
}

interface Manifest {
  name: string
  kind?: string
  changelog?: string
  install?: {
    start?: string[]
    symlinks?: Array<{ from: string; to: string }>
    place?: Placement[]
    instrument?: Instrumentation[]
  }
  stop?: string[]
}

// A place/instrument entry names its payload file directly (`src`/`diff`) OR carries per-printer
// `variants`, each with its own `src`/`diff` (a `.ko` cross-built per kernel, a binary per arch). All
// of them must live inside the plugin's own files/ dir, so collect the variant sources too.
function placementSources(placement: Placement): string[] {
  const variantSrcs = (placement.variants ?? []).map((variant) => variant.src)

  return [placement.src, ...variantSrcs].filter((src): src is string => Boolean(src))
}

function instrumentSources(entry: Instrumentation): string[] {
  const variantDiffs = (entry.variants ?? []).map((variant) => variant.diff)

  return [entry.diff, ...variantDiffs].filter((diff): diff is string => Boolean(diff))
}

function payloadSources(manifest: Manifest): string[] {
  const legacy = (manifest.install?.symlinks ?? [])
    .map((symlink) => symlink.from)
    .filter((from): from is string => Boolean(from))
  const placed = (manifest.install?.place ?? []).flatMap(placementSources)
  const instrumented = (manifest.install?.instrument ?? []).flatMap(instrumentSources)

  return [...legacy, ...placed, ...instrumented]
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function subdirs(dir: string): string[] {
  try {
    return readdirSync(dir).filter((entry) => !SKIP_DIRS.has(entry) && statSync(join(dir, entry)).isDirectory())
  } catch {
    return []
  }
}

// Plugins live in the sibling plugins/ tree (the repo split): each repo holds one or more
// <plugin>/manifest.json. A plugin dir is a leaf, so descent stops at the first manifest.
function pluginDirs(root: string, depth: number): string[] {
  if (depth < 0) return []
  if (isFile(join(root, 'manifest.json'))) return [root]

  return subdirs(root).flatMap((dir) => pluginDirs(join(root, dir), depth - 1))
}

function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf-8'))
}

const SERVICE_ACTION = /\b(?:restart|start|reload|stop)\b/

function controlsServiceOnly(command: string): boolean {
  if (!SERVICE_ACTION.test(command)) return false

  return command.includes('init.d') || /\bnginx\b/.test(command)
}

// A collection (kind:collection) is install-orchestration metadata, not a plugin: it ships no files/
// and no install block, so the plugin-isolation checks below do not apply to it.
function isPluginDir(dir: string): boolean {
  return readManifest(dir).kind !== 'collection'
}

describe('plugin system-isolation invariant', () => {
  pluginDirs(PLUGINS_DIR, 4).filter(isPluginDir).forEach(function checkPlugin(dir) {
    const manifest = readManifest(dir)
    const name = manifest.name
    const commands = [...(manifest.install?.start ?? []), ...(manifest.stop ?? [])]

    it(`${name}: start/stop commands only control services, never write files`, () => {
      const violations = commands.filter((command) => !controlsServiceOnly(command))
      expect(violations).toEqual([])
    })

    it(`${name}: payload sources stay inside the plugin's own files/ dir`, () => {
      const offending = payloadSources(manifest).filter((source) => !source.startsWith('files/'))
      expect(offending).toEqual([])
    })

    it(`${name}: ships a changelog the manifest points at`, () => {
      expect(manifest.changelog, `${name} must declare a changelog in its manifest`).toBeTruthy()
      expect(isFile(join(dir, manifest.changelog ?? '')), `${name} changelog file is missing`).toBe(true)
    })
  })
})
