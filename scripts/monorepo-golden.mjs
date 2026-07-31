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
export const GOLDEN_ARCHIVES_PATH = join(GOLDEN_DIR, 'packed-archives.json')

// Which plugins the golden describes. It is a fixture, NOT scripts/bundle.dev.json: that file is a
// developer's own scratch curation of what their local dev build packs, so a rail that read it would
// go red the moment someone trimmed their own list. The two happen to have the same shape and started
// from the same contents; they are free to diverge from here.
export function goldenDevCuration() {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, 'bundled-plugins.json'), 'utf8'))
}

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
    return await buildBundle({ sourceRoot: APP_REPO_DIR, outputDir, channel: 'dev', devCuration: goldenDevCuration() })
  } finally {
    if (shellSigningKey !== undefined) process.env[SIGNING_KEY_VAR] = shellSigningKey
  }
}

// `+dev.<hash8>` is a hash of the plugin's files AS THEY SIT ON DISK, so it moves whenever anyone
// edits a plugin repo working copy, released or not. The fixture holds a placeholder in its place: a
// rail that pinned the real hash went red for whoever happened to have an unsaved experiment in a
// sibling repo, which is the same "my local file turned your check red" defect as reading a
// developer's own bundle.dev.json. Nothing ships this tag (a release build never builds dev atoms),
// so pinning it bought nothing.
const DEV_BUILD_TAG = /\+dev\.[0-9a-f]{8}/g
const DEV_BUILD_TAG_PLACEHOLDER = '+dev.local'

export function withoutDevBuildTags(index) {
  return JSON.parse(JSON.stringify(index).replace(DEV_BUILD_TAG, DEV_BUILD_TAG_PLACEHOLDER))
}

// The bytes the fixture holds, from the index a build produced. buildBundle writes the bundled index
// this way too, so the fixture is the same text an actual offline bundle ships, dev build tags aside.
export function goldenIndexText(index) {
  return `${JSON.stringify(withoutDevBuildTags(index), null, 2)}\n`
}

export function readGoldenIndexText() {
  return readFileSync(GOLDEN_INDEX_PATH, 'utf8')
}

export function readGoldenIndex() {
  return JSON.parse(readGoldenIndexText())
}

// `<name>-<semver>.b3` minus the version: the archive's identity, which the golden can pin without
// pinning whatever version a plugin repo released this week.
export function packageStem(filename) {
  return filename.replace(/-\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\.b3$/, '')
}

// The archives a golden build packs, by identity. One id can appear twice: a stable atom and its
// dev-only channel variant are two archives under one name.
export function packedArchiveStems(packages) {
  return packages.map((packed) => packageStem(packed.filename)).sort()
}

export function readGoldenArchives() {
  return JSON.parse(readFileSync(GOLDEN_ARCHIVES_PATH, 'utf8')).archives
}

export function writeGoldenArchives(packages) {
  writeFileSync(GOLDEN_ARCHIVES_PATH, `${JSON.stringify({ archives: packedArchiveStems(packages) }, null, 2)}\n`)
}

export function writeGoldenIndex(index) {
  writeFileSync(GOLDEN_INDEX_PATH, goldenIndexText(index))
}
