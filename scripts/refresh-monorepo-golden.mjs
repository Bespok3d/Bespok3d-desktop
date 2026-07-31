// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// `npm run golden:refresh`: regenerate both monorepo golden fixtures (index.json and
// packed-archives.json) from the manifests the sibling plugin repos carry right now.
//
// Run it when a plugin repo changes a manifest and the app's bundle rail goes red, and commit the
// refreshed fixture with the change that caused it. It builds the bundle through exactly the code the
// rail builds it with, so a green rail after a refresh means the fixture matches a real build and not
// a hand-typed guess.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  GOLDEN_ARCHIVES_PATH,
  GOLDEN_INDEX_PATH,
  PLUGIN_SOURCES_DIR,
  buildGoldenBundle,
  ensureBuilderBuilt,
  hasPluginSources,
  writeGoldenArchives,
  writeGoldenIndex,
} from './monorepo-golden.mjs'

async function refreshGolden() {
  if (!hasPluginSources()) {
    console.error(`No plugin repos at ${PLUGIN_SOURCES_DIR}.`)
    console.error('The golden snapshots those manifests, so it can only be refreshed inside the Bespok3d workspace.')
    process.exitCode = 1

    return
  }

  ensureBuilderBuilt()
  const outputDir = mkdtempSync(join(tmpdir(), 'golden-refresh-'))
  try {
    const { index, packages } = await buildGoldenBundle(outputDir)
    writeGoldenIndex(index)
    writeGoldenArchives(packages)
    console.log(`Refreshed ${GOLDEN_INDEX_PATH}`)
    console.log(`Refreshed ${GOLDEN_ARCHIVES_PATH}`)
    console.log(`  ${index.plugins.length} plugins, ${index.collections.length} collections, ${packages.length} archives, updated ${index.updated}`)
    console.log('  Review the diff and commit it with the manifest change that caused it.')
  } finally {
    rmSync(outputDir, { recursive: true, force: true })
  }
}

await refreshGolden()
