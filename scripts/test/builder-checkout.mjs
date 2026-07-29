// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The sibling b3-builder checkout, as the two bundle rails need it. Both build a REAL bundle through
// app-bundle.mjs, which imports the builder's compiled core, so both have to make sure that core is
// compiled and both write a scratch output dir worth ~60MB of packages. One home for that, so a change
// to how the checkout is prepared cannot land in one rail and leave the other stale.
//
// The checkout paths and the build step themselves live in ../monorepo-golden.mjs, because the golden
// refresh command needs the same ones and is not a test: defining them here would drag node:test into
// a plain script. They are re-exported so a rail keeps one import for its checkout needs.

import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { after } from 'node:test'

import { APP_REPO_DIR, B3_BUILDER_DIR, WORKSPACE_DIR, ensureBuilderBuilt } from '../monorepo-golden.mjs'

export { APP_REPO_DIR, B3_BUILDER_DIR, WORKSPACE_DIR, ensureBuilderBuilt }

// Bespok3d/scripts has no package of its own, so a rail's zip reader and openpgp come from the sibling
// checkout it already depends on, exactly as app-bundle.mjs sources the builder core. Resolved lazily,
// after ensureBuilderBuilt has had its chance to install them.
export function builderDependency(packageName) {
  return createRequire(join(B3_BUILDER_DIR, 'package.json'))(packageName)
}

export function builderCore() {
  return import(pathToFileURL(join(B3_BUILDER_DIR, 'dist', 'core', 'index.js')).href)
}

// A bundled build writes ~60MB of packages per output dir, so a rail deletes the ones it created rather
// than leaving them in the system temp dir once per check.sh run.
const scratchOutputDirs = []

after(function removeScratchOutputDirs() {
  scratchOutputDirs.forEach((outputDir) => rmSync(outputDir, { recursive: true, force: true }))
})

export function makeScratchOutputDir(namePrefix) {
  const outputDir = mkdtempSync(join(tmpdir(), namePrefix))
  scratchOutputDirs.push(outputDir)

  return outputDir
}
