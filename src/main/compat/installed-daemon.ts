// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The daemon the printer has on its disk, and an enrollment that keeps it when it is newer.
//
// Recovery after a firmware update re-enrolls a printer whose daemon is not running, so asking the
// daemon its version answers nothing. Its files live under the bespok3d root, which the update leaves
// alone, so they still say which daemon is installed. It is weighed against the package the deploy
// would land, opened the same way the deploy opens it: the published daemon, or this build's own copy
// when the published one cannot be downloaded. Only a daemon newer than that package is kept.
//
// The same version still runs the deploy, which sends only the files whose checksum differs from the
// printer's: a deploy that stopped part way may already have written the new version file, and this
// finishes it without sending the daemon again. A kept daemon still gets its jinni and its packages
// brought up to date.
import { isNewerVersion, reportedVersionOrNull } from '@bespok3d/contract'
import type { AdapterDefinition, EnrollContext, EnrollStep } from '../adapter-loader'
import { bespok3dRootOn } from '../adapter-loader/bespok3d-root'
import { DAEMON_DEPLOY_STEP_ID } from '../adapter-loader/step-ids'
import { DAEMON_PACKAGE } from '../daemon-client/version'
import { shellQuote } from '../ssh'
import type { SshSession } from '../ssh'
import { openSystemPackage } from '../store/system-package'
import { refreshKeptDaemon } from './kept-daemon'

const DAEMON_VERSION_FILE_IN_ROOT = 'var/lib/daemon/version.py'
const DAEMON_VERSION_LINE = /^DAEMON_VERSION\s*=\s*["']([^"']+)["']/m

export async function installedDaemonVersion(ssh: SshSession, bespok3dRoot: string): Promise<string | null> {
  const versionSource = await ssh.exec(`cat ${shellQuote(`${bespok3dRoot}/${DAEMON_VERSION_FILE_IN_ROOT}`)} 2>/dev/null; true`)

  return reportedVersionOrNull(versionSource.match(DAEMON_VERSION_LINE)?.[1])
}

async function isNewerThanDeploying(installedVersion: string | null): Promise<boolean> {
  if (installedVersion === null) return false
  const deployingPackage = await openSystemPackage(DAEMON_PACKAGE)

  return isNewerVersion(installedVersion, deployingPackage.version)
}

async function deployUnlessInstalledIsNewer(deployStep: EnrollStep, adapter: AdapterDefinition, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  const installedVersion = await installedDaemonVersion(ssh, bespok3dRootOn(adapter))
  if (!(await isNewerThanDeploying(installedVersion))) return deployStep.run(ssh, ctx)

  ctx.onProgress?.(`This printer already has a newer Bespok3d daemon (${installedVersion}), so it is kept.`)
  await refreshKeptDaemon(adapter, ssh, ctx)
}

export function keepingNewerInstalledDaemon(step: EnrollStep, adapter: AdapterDefinition): EnrollStep {
  if (step.id !== DAEMON_DEPLOY_STEP_ID) return step

  return { ...step, run: (ssh, ctx) => deployUnlessInstalledIsNewer(step, adapter, ssh, ctx) }
}
