// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TFunction } from '../i18n'

// Strip semver build metadata (`+...`) and the prerelease tail (`-...`) before reading the numeric
// release triple, so a dev build-tag (e.g. `0.1.6+dev.3a7f1c2`) compares equal to its untagged base
// and two different dev builds of the same release never look like an update of one another.
function parseVersion(version: string): number[] {
  return version.split('+')[0].split('-')[0].split('.').map((part) => parseInt(part, 10) || 0)
}

function firstVersionDelta(left: string, right: string): number {
  const leftParts = parseVersion(left)
  const rightParts = parseVersion(right)
  const slotCount = Math.max(leftParts.length, rightParts.length)
  const delta = Array.from({ length: slotCount }, (_, slot) => (leftParts[slot] ?? 0) - (rightParts[slot] ?? 0)).find(
    (value) => value !== 0,
  )

  return delta ?? 0
}

export function isDaemonVersionAtLeast(current: string, required: string): boolean {
  return firstVersionDelta(current, required) >= 0
}

// True only when `candidate` is strictly newer than `installed`. Used for update detection so an
// installed version AHEAD of the catalog (e.g. a dev build newer than the published release) is not
// mislabelled as an available update.
export function isNewerVersion(candidate: string, installed: string): boolean {
  return firstVersionDelta(candidate, installed) > 0
}

// True when two versions are the same numeric release, ignoring build metadata and the prerelease tail.
// A dev-bundle version (`0.1.6+dev.3a7f1c2`) therefore matches the clean `0.1.6` a device reports, so a
// normal install is not mistaken for a drifted one.
export function sameVersion(left: string, right: string): boolean {
  return firstVersionDelta(left, right) === 0
}

// How a plugin's version reads in the store. A plugin that packages an external project (fluidd,
// tailscale) leads with the PACKAGED upstream version the user actually cares about and keeps its own
// plugin version in brackets (`v1.37.2 (plugin v0.1.4)`); a plugin that wraps nothing shows just its
// own version (`v0.1.4`).
export function versionLabel(t: TFunction, version: string, swVersion?: string): string {
  if (!swVersion) return `v${version}`

  return `v${swVersion} ${t('store.plugin_version_note', { version })}`
}
