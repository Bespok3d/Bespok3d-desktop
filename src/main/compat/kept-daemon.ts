// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// When the printer keeps a newer daemon than this app would install, the deploy that would also bring
// the jinni and the daemon's packages up to date does not run. Both are brought up here: the jinni is
// sent only when the offer rule says the printer's build is not the one this app offers, and the
// packages come from the files the kept daemon brought with it.
import { isUpgradeOffered, reportedVersionOrNull, type PackageBuild } from '@bespok3d/contract'
import type { AdapterDefinition, EnrollContext } from '../adapter-loader'
import { findAdapterStep } from '../adapter-loader/adapter-step'
import { bespok3dRootOn } from '../adapter-loader/bespok3d-root'
import { DAEMON_VENV_REFRESH_STEP_ID, JINNI_DEPLOY_STEP_ID } from '../adapter-loader/step-ids'
import { shellQuote } from '../ssh'
import type { SshSession } from '../ssh'
import { offeredJinniBuild } from './jinni-baseline'

// The jinni lives beside the daemon and names its version in this file.
const JINNI_VERSION_FILE_IN_ROOT = 'var/lib/daemon/version.json'
const JINNI_VERSION_FIELD = /"jinni_version"\s*:\s*"([^"]+)"/
// The adapter keeps each machinery package's signed manifest here, named after the package.
const MACHINERY_MANIFEST_DIR_IN_ROOT = 'var/lib/daemon/manifests'

interface InstalledJinni {
  version: string | null
  fingerprint: string | null
}

export async function installedJinniVersion(ssh: SshSession, bespok3dRoot: string): Promise<string | null> {
  const versionFile = await ssh.exec(`cat ${shellQuote(`${bespok3dRoot}/${JINNI_VERSION_FILE_IN_ROOT}`)} 2>/dev/null; true`)

  return reportedVersionOrNull(versionFile.match(JINNI_VERSION_FIELD)?.[1])
}

export async function installedJinniFingerprint(ssh: SshSession, bespok3dRoot: string, jinniPackage: string): Promise<string | null> {
  const manifestPath = `${bespok3dRoot}/${MACHINERY_MANIFEST_DIR_IN_ROOT}/${jinniPackage}.json`
  const manifestText = await ssh.exec(`cat ${shellQuote(manifestPath)} 2>/dev/null; true`)

  return fingerprintOf(manifestText)
}

// A missing or torn manifest names no fingerprint, and the offer rule then weighs versions alone.
function fingerprintOf(manifestText: string): string | null {
  try {
    const manifest: unknown = JSON.parse(manifestText)
    const fingerprint = (manifest as { fingerprint?: unknown } | null)?.fingerprint

    return typeof fingerprint === 'string' ? fingerprint : null
  } catch {
    return null
  }
}

// This path runs on its own, with no one asked, so it never sends a jinni older than the printer's:
// a newer release is kept, an older one is replaced, and within one release the fingerprints decide,
// so a rebuild of the same version still lands. A printer with no jinni at all is behind.
function jinniIsBehind(installed: InstalledJinni, offered: PackageBuild): boolean {
  if (installed.version === null) return true

  return isUpgradeOffered({ version: installed.version, fingerprint: installed.fingerprint }, offered, 'release')
}

function jinniOfferedBy(adapter: AdapterDefinition): PackageBuild {
  return offeredJinniBuild(adapter) ?? { version: adapter.jinniVersion }
}

async function bringJinniUpUnlessCurrent(adapter: AdapterDefinition, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  const jinniStep = findAdapterStep(adapter, JINNI_DEPLOY_STEP_ID)
  if (!jinniStep) return
  const bespok3dRoot = bespok3dRootOn(adapter)
  const installed: InstalledJinni = {
    version: await installedJinniVersion(ssh, bespok3dRoot),
    fingerprint: await installedJinniFingerprint(ssh, bespok3dRoot, adapter.jinniPackage),
  }
  if (!jinniIsBehind(installed, jinniOfferedBy(adapter))) return

  await jinniStep.run(ssh, { ...ctx, sendChangedFilesOnly: true })
}

export async function refreshKeptDaemon(adapter: AdapterDefinition, ssh: SshSession, ctx: EnrollContext): Promise<void> {
  await bringJinniUpUnlessCurrent(adapter, ssh, ctx)
  await findAdapterStep(adapter, DAEMON_VENV_REFRESH_STEP_ID)?.run(ssh, ctx)
}
