// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { buildSync } from 'esbuild'

const repository = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)

test('packaged E2E launches the development bundle named by the channel table', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'e2e-launch-name-'))
  const channels = JSON.parse(readFileSync(join(repository, 'scripts/channel-table.json'), 'utf8'))
  const productName = channels.development.productName
  const binary = join(scratch, 'dist/release/mac-arm64', `${productName}.app`, 'Contents/MacOS', productName)
  mkdirSync(dirname(binary), { recursive: true })
  mkdirSync(join(scratch, 'e2e'))
  mkdirSync(join(scratch, 'scripts'))
  writeFileSync(binary, 'test executable placeholder')
  writeFileSync(join(scratch, 'scripts/channel-table.json'), JSON.stringify(channels))
  const modulePath = join(scratch, 'launcher.cjs')
  try {
    buildSync({ entryPoints: [join(repository, 'e2e/app-launch.ts')], outfile: modulePath, bundle: true, platform: 'node', format: 'cjs', define: { __dirname: JSON.stringify(join(scratch, 'e2e')) } })
    assert.equal(require(modulePath).appEnv().B3D_E2E_BINARY, binary)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})
