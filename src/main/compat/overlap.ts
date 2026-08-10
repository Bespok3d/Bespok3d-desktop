// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Two packages that would write over each other, caught before either is installed.
//
// The daemon and the printer's support package are deployed as a pair onto the same tree. If both
// carry a top-level entry of the same name, the second one to land silently replaces the first one's
// copy, and the printer ends up running half of each: a pair that passed every version floor and is
// still broken. The names are compared while both packages are still files on this machine, so the
// refusal costs the printer nothing.
import { basename } from 'node:path'

// The name a payload path claims at the root of the deployed tree. Everything below it belongs to that
// entry, so two packages clash on the first segment and nothing deeper.
function topLevelEntry(payloadPath: string): string {
  const [entry] = payloadPath.replace(/^\/+/, '').split('/')

  return entry ?? basename(payloadPath)
}

export function topLevelEntries(payloadPaths: readonly string[]): readonly string[] {
  return [...new Set(payloadPaths.map(topLevelEntry).filter((entry) => entry !== ''))]
}

export interface PackageEntries {
  packageName: string
  payloadPaths: readonly string[]
}

// Why these two packages must not both be installed, naming the entries they fight over, or null when
// they can live side by side.
export function sharedEntryRefusal(first: PackageEntries, second: PackageEntries): string | null {
  const firstEntries = new Set(topLevelEntries(first.payloadPaths))
  const shared = topLevelEntries(second.payloadPaths).filter((entry) => firstEntries.has(entry))
  if (shared.length === 0) return null

  return `${first.packageName} and ${second.packageName} both install ${shared.join(', ')}, so installing ` +
    `both would leave the printer running part of each. Neither was installed. This is a defect in the ` +
    `packages themselves: one of the two has to rename what it installs.`
}

// Why a set of packages must not all be installed together, or null when every one of them can live
// beside the others. One action can carry more than two (a plugin and the dependencies pulled in with
// it), and any pair of them landing on the same tree is the same defect, so every pair is compared.
export function firstOverlapRefusal(packages: readonly PackageEntries[]): string | null {
  const [head, ...rest] = packages
  if (head === undefined) return null

  return rest.map((other) => sharedEntryRefusal(head, other)).find((refusal) => refusal !== null)
    ?? firstOverlapRefusal(rest)
}
