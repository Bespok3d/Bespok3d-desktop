// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Generate the app-side daemon version module (src/main/daemon-client/version.ts) from the single
// source of truth: the sibling daemon repo's version.py. The app must expect the exact daemon version
// it bundles, so generating the constant instead of hand-mirroring it means the two can never drift
// and no app-side drift test is needed. Run by predev/prebuild/pretest (and so by the gate, which
// runs the tests first), and the generated file is gitignored, never committed.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DAEMON_VERSION_PATTERN = /DAEMON_VERSION\s*=\s*"([^"]+)"/

function readDaemonVersion(versionFile) {
  const match = readFileSync(versionFile, 'utf-8').match(DAEMON_VERSION_PATTERN)
  if (!match) throw new Error(`could not find DAEMON_VERSION in ${versionFile}`)

  return match[1]
}

function versionModuleSource(daemonVersion) {
  return [
    '// @generated from daemon/version.py by scripts/generate-daemon-version.mjs. Do not edit.',
    '// The daemon version this app build ships and expects, single-sourced from the sibling daemon',
    "// repo's version.py so the two can never drift. Dependency-free so preload exposes it to the",
    '// renderer without node-only imports.',
    `export const EXPECTED_DAEMON_VERSION = '${daemonVersion}'`,
    '',
  ].join('\n')
}

function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const repoDir = dirname(scriptDir)
  const versionFile = join(repoDir, '..', 'daemon', 'version.py')
  const outputFile = join(repoDir, 'src', 'main', 'daemon-client', 'version.ts')
  const daemonVersion = readDaemonVersion(versionFile)
  writeFileSync(outputFile, versionModuleSource(daemonVersion))
  process.stdout.write(`Wrote ${outputFile} (EXPECTED_DAEMON_VERSION=${daemonVersion})\n`)
}

if (process.argv[1] && process.argv[1].endsWith('generate-daemon-version.mjs')) {
  main()
}
