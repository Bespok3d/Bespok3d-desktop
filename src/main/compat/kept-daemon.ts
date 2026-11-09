// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// When the printer keeps a newer daemon than this app would install, the deploy that would also bring
// the jinni and the daemon's packages up to date does not run. Both are brought up here, never
// backwards: the jinni is sent only when the printer's is older than the one this app offers, and the
// packages come from the files the kept daemon brought with it.
import { isNewerVersion, reportedVersionOrNull } from '@bespok3d/contract'
import type { AdapterDefinition, EnrollContext } from '../adapter-loader'
import { findAdapterStep } from '../adapter-loader/adapter-step'
import { bespok3dRootOn } from '../adapter-loader/bespok3d-root'
import { DAEMON_VENV_REFRESH_STEP_ID, JINNI_DEPLOY_STEP_ID } from '../adapter-loader/step-ids'
import { shellQuote } from '../ssh'
import type { SshSession } from '../ssh'
import { offeredJinniVersion } from './jinni-baseline'

// The jinni lives beside the daemon and names its version in this file.
const JINNI_VERSION_FILE_IN_ROOT = 'var/lib/daemon/version.json'
const JINNI_VERSION_FIELD = /"jinni_version"\s*:\s*"([^"]+)"/

export async function installedJinniVersion(ssh: SshSession, bespok3dRoot: string): Promise<string | null> {
  const versionFile = await ssh.exec(`cat ${shellQuote(`${bespok3dRoot}/${JINNI_VERSION_FILE_IN_ROOT}`)} 2>/dev/null; true`)

  return reportedVersionOrNull(versionFile.match(JINNI_VERSION_FIELD)?.[1])
}

function jinniIsBehind(installedVersion: string | null, offeredVersion: string): boolean {
  return installedVersion === null || isNewerVersion(offeredVersion, installedVersion)
}

async function bringJinniUpUnlessNewer(adapter: AdapterDefinition, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  const jinniStep = findAdapterStep(adapter, JINNI_DEPLOY_STEP_ID)
  if (!jinniStep) return
  const installedVersion = await installedJinniVersion(ssh, bespok3dRootOn(adapter))
  if (!jinniIsBehind(installedVersion, offeredJinniVersion(adapter) ?? adapter.jinniVersion)) return

  await jinniStep.run(ssh, { ...ctx, sendChangedFilesOnly: true })
}

export async function refreshKeptDaemon(adapter: AdapterDefinition, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  await bringJinniUpUnlessNewer(adapter, ssh, ctx)
  await findAdapterStep(adapter, DAEMON_VENV_REFRESH_STEP_ID)?.run(ssh, ctx)
}
