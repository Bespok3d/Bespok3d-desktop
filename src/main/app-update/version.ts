// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Prerelease-aware semantic-version comparison for the auto-updater. Releases carry a maturity
// label ("0.7.0-beta"), and the alphas that came before it counted theirs ("0.1.0-alpha.36"), so
// the comparison has to order both: two labelled releases of the same triple, and a labelled one
// against a bare one (the renderer's utils/version.ts drops the suffix and cannot). A stable
// release sorts above any prerelease of the same triple, matching the semver precedence rule.

export interface ParsedVersion {
  release: number[]
  prereleaseLabel: string | null
  prereleaseNumber: number
}

function parsePrerelease(prerelease: string | undefined): {
  prereleaseLabel: string | null
  prereleaseNumber: number
} {
  if (!prerelease) return { prereleaseLabel: null, prereleaseNumber: 0 }
  const [label, number] = prerelease.split('.')

  return { prereleaseLabel: label, prereleaseNumber: Number(number) || 0 }
}

export function parseSemanticVersion(version: string): ParsedVersion {
  const normalized = version.trim().replace(/^v/, '')
  const [base, prerelease] = normalized.split('-')
  const release = base.split('.').map((part) => Number(part) || 0)

  return { release, ...parsePrerelease(prerelease) }
}

function compareNumberLists(leftParts: number[], rightParts: number[]): number {
  const length = Math.max(leftParts.length, rightParts.length)
  const positions = Array.from({ length }, (_unused, index) => index)
  const firstDifference = positions.find((index) => (leftParts[index] ?? 0) !== (rightParts[index] ?? 0))
  if (firstDifference === undefined) return 0

  return (leftParts[firstDifference] ?? 0) < (rightParts[firstDifference] ?? 0) ? -1 : 1
}

function comparePrerelease(installed: ParsedVersion, candidate: ParsedVersion): number {
  if (!installed.prereleaseLabel && !candidate.prereleaseLabel) return 0
  if (!installed.prereleaseLabel) return 1
  if (!candidate.prereleaseLabel) return -1
  if (installed.prereleaseLabel !== candidate.prereleaseLabel) {
    return installed.prereleaseLabel < candidate.prereleaseLabel ? -1 : 1
  }

  return Math.sign(installed.prereleaseNumber - candidate.prereleaseNumber)
}

// -1 when installed is older, 0 when equal, 1 when installed is newer.
export function compareSemanticVersions(installedVersion: string, candidateVersion: string): number {
  const installed = parseSemanticVersion(installedVersion)
  const candidate = parseSemanticVersion(candidateVersion)
  const releaseOrder = compareNumberLists(installed.release, candidate.release)
  if (releaseOrder !== 0) return releaseOrder

  return comparePrerelease(installed, candidate)
}

export function isReleaseNewer(installedVersion: string, candidateTag: string): boolean {
  return compareSemanticVersions(installedVersion, candidateTag) < 0
}
