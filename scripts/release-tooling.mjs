// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { git, command } from './release-io.mjs'

export async function releaseTooling(directory, expectedCommit) {
  if (expectedCommit && git(directory, ['rev-parse', 'HEAD']) !== expectedCommit) throw new Error('builder tooling pin mismatch')
  if (git(directory, ['status', '--porcelain', '--untracked-files=no'])) throw new Error('builder tooling checkout is dirty')
  command('npm', ['run', 'build'], { cwd: directory })
  const modules = await Promise.all(['verify-package', 'version-only', 'version-source', 'prepared-receipt', 'prepared-artifact', 'release-evidence', 'publish-units', 'preflight-list'].map(function (name) {
    return import(pathToFileURL(join(directory, 'dist/action', `${name}.js`)).href)
  }))
  const signing = await import(pathToFileURL(join(directory, 'dist/core/build/sign-bytes.js')).href)
  return Object.assign({}, ...modules, signing)
}
