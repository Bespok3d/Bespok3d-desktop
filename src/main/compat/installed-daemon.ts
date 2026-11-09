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
// The same version is deployed again on purpose. A deploy that stopped part way may already have
// written the new version file, and only running the step again finishes it; the same step also brings
// the adapter's jinni up to date.
import { isNewerVersion, reportedVersionOrNull } from '@bespok3d/contract'
import type { EnrollContext, EnrollStep } from '../adapter-loader'
import { DAEMON_DEPLOY_STEP_ID } from '../adapter-loader/step-ids'
import { DAEMON_PACKAGE } from '../daemon-client/version'
import type { SshSession } from '../ssh'
import { openSystemPackage } from '../store/system-package'

const DAEMON_VERSION_FILE_IN_ROOT = 'var/lib/daemon/version.py'
const DAEMON_VERSION_LINE = /^DAEMON_VERSION\s*=\s*["']([^"']+)["']/m

export async function installedDaemonVersion(ssh: SshSession, bespok3dRoot: string): Promise<string | null> {
  const versionSource = await ssh.exec(`cat ${bespok3dRoot}/${DAEMON_VERSION_FILE_IN_ROOT} 2>/dev/null; true`)

  return reportedVersionOrNull(versionSource.match(DAEMON_VERSION_LINE)?.[1])
}

async function isNewerThanDeploying(installedVersion: string | null): Promise<boolean> {
  if (installedVersion === null) return false
  const deployingPackage = await openSystemPackage(DAEMON_PACKAGE)

  return isNewerVersion(installedVersion, deployingPackage.version)
}

async function deployUnlessInstalledIsNewer(deployStep: EnrollStep, bespok3dRoot: string, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  const installedVersion = await installedDaemonVersion(ssh, bespok3dRoot)
  if (!(await isNewerThanDeploying(installedVersion))) return deployStep.run(ssh, ctx)

  ctx.onProgress?.(`This printer already has a newer Bespok3d daemon (${installedVersion}), so it is kept.`)
}

export function keepingNewerInstalledDaemon(step: EnrollStep, bespok3dRoot: string): EnrollStep {
  if (step.id !== DAEMON_DEPLOY_STEP_ID) return step

  return { ...step, run: (ssh, ctx) => deployUnlessInstalledIsNewer(step, bespok3dRoot, ssh, ctx) }
}
