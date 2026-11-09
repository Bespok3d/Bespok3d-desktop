// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The daemon the printer has on its disk, and an enrollment that keeps it when it is newer.
//
// Recovery after a firmware update re-enrolls a printer whose daemon is not running, so asking the
// daemon its version answers nothing. Its files live under /userdata, which the update leaves alone,
// so they still say which daemon is installed. One newer than this app would install is kept: the
// deploy would put the printer backwards and lose whatever that daemon added.
//
// The same version is deployed again on purpose. A deploy that stopped part way may already have
// written the new version file, and only running the step again finishes it; the same step also brings
// the adapter's jinni up to date.
import { isNewerVersion, reportedVersionOrNull } from '@bespok3d/contract'
import type { EnrollContext, EnrollStep } from '../adapter-loader'
import { DAEMON_DEPLOY_STEP_ID } from '../adapter-loader/step-ids'
import { expectedDaemonVersion } from '../daemon-client/expected-version'
import type { SshSession } from '../ssh'

const INSTALLED_DAEMON_VERSION_FILE = '/userdata/bespok3d/var/lib/daemon/version.py'
const DAEMON_VERSION_LINE = /^DAEMON_VERSION = "([^"]+)"$/m

export async function installedDaemonVersion(ssh: SshSession): Promise<string | null> {
  const versionSource = await ssh.exec(`cat ${INSTALLED_DAEMON_VERSION_FILE} 2>/dev/null; true`)

  return reportedVersionOrNull(versionSource.match(DAEMON_VERSION_LINE)?.[1])
}

function isNewerThanDeploying(installedVersion: string | null, deployingVersion: string): installedVersion is string {
  return installedVersion !== null && isNewerVersion(installedVersion, deployingVersion)
}

async function deployUnlessInstalledIsNewer(deployStep: EnrollStep, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  const installedVersion = await installedDaemonVersion(ssh)
  if (!isNewerThanDeploying(installedVersion, expectedDaemonVersion())) return deployStep.run(ssh, ctx)

  ctx.onProgress?.(`This printer already has a newer Bespok3d daemon (${installedVersion}), so it is kept.`)
}

export function keepingNewerInstalledDaemon(step: EnrollStep): EnrollStep {
  if (step.id !== DAEMON_DEPLOY_STEP_ID) return step

  return { ...step, run: (ssh, ctx) => deployUnlessInstalledIsNewer(step, ssh, ctx) }
}
