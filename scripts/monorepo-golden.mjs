// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The monorepo golden fixture, and the ONE way it is produced. `npm run golden:refresh` and the rails
// under scripts/test/ both come through here, so the file a rail compares against is by construction
// the file the refresh command writes: neither can drift from the other.
//
// Why THIS golden is refreshable and b3-builder's equivalence golden is not: b3-builder's is real
// output captured from the legacy publishing scripts before they were deleted, so the capture tool no
// longer exists and a regenerated fixture could not make the claim that rail makes. This one snapshots
// the manifests the sibling plugin repos carry RIGHT NOW, and those repos are still here, so a plugin
// release is answered by regenerating the fixture and never by hand-editing it.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildBundle } from './app-bundle.mjs'
import { SIGNING_KEY_VAR } from './bundle-signing.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

export const APP_REPO_DIR = dirname(HERE)
export const WORKSPACE_DIR = dirname(APP_REPO_DIR)
export const B3_BUILDER_DIR = join(WORKSPACE_DIR, 'b3-builder')
export const PLUGIN_SOURCES_DIR = join(WORKSPACE_DIR, 'plugins')
export const GOLDEN_DIR = join(HERE, 'test', 'golden', 'monorepo')
export const GOLDEN_INDEX_PATH = join(GOLDEN_DIR, 'index.json')

// Named once so the failing rail, the refresh script and the contributor guides all quote the same
// string: a fix instruction that has drifted from the command that exists is worse than none.
export const REFRESH_COMMAND = 'npm run golden:refresh'

// A checkout of this repo alone has no plugin repos beside it to build a bundle from. That is a
// supported checkout (a contributor cloning only the app), not a broken one.
export function hasPluginSources() {
  return existsSync(PLUGIN_SOURCES_DIR)
}

export function ensureBuilderBuilt() {
  if (!existsSync(join(B3_BUILDER_DIR, 'node_modules'))) {
    execFileSync('npm', ['install'], { cwd: B3_BUILDER_DIR, stdio: 'inherit' })
  }
  execFileSync('npm', ['run', 'build', '--silent'], { cwd: B3_BUILDER_DIR, stdio: 'inherit' })
}

// The golden pins an UNSIGNED build. A signed build derives its publisher from whichever key the shell
// happens to carry, so without this a refresh (or a rail) run from a publishing shell would rewrite the
// fixture for that one key, and the next run from any other shell would disagree with it.
export async function buildGoldenBundle(outputDir) {
  const shellSigningKey = process.env[SIGNING_KEY_VAR]
  delete process.env[SIGNING_KEY_VAR]
  try {
    return await buildBundle({ sourceRoot: APP_REPO_DIR, outputDir, channel: 'dev' })
  } finally {
    if (shellSigningKey !== undefined) process.env[SIGNING_KEY_VAR] = shellSigningKey
  }
}

// The bytes the fixture holds, from the index a build produced. buildBundle writes the bundled index
// this way too, so the fixture is the same text an actual offline bundle ships.
export function goldenIndexText(index) {
  return `${JSON.stringify(index, null, 2)}\n`
}

export function readGoldenIndexText() {
  return readFileSync(GOLDEN_INDEX_PATH, 'utf8')
}

export function readGoldenIndex() {
  return JSON.parse(readGoldenIndexText())
}

export function writeGoldenIndex(index) {
  writeFileSync(GOLDEN_INDEX_PATH, goldenIndexText(index))
}
