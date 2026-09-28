// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { buildSync } from 'esbuild'

const repository = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)

test('bundled main channel loads without loose build-script JSON files', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'packaged-channel-'))
  const modulePath = join(scratch, 'channel.cjs')
  try {
    buildSync({ entryPoints: [join(repository, 'src/main/channel.ts')], outfile: modulePath, bundle: true, platform: 'node', format: 'cjs', define: { __B3D_CHANNEL__: JSON.stringify('development') } })
    const channel = require(modulePath)
    assert.equal(channel.APP_CHANNEL.appName, 'Bespok3d Dev')
    assert.equal(channel.officialIndexUrl(channel.APP_CHANNEL), 'github:Bespok3d/main-index/index.json')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})
