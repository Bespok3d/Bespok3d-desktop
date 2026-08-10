// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What a compatibility refusal SAYS. The decision itself is `@bespok3d/contract`'s `compat` module,
// which the store card reads too, so the card and the install path can never disagree about whether a
// package fits; this file only turns a refused pair into a sentence.
//
// Every refusal names the SIDE to update and the version to reach it. "Incompatible" on its own leaves
// the owner guessing which of the two halves he is supposed to move, which is the whole failure this
// contract exists to prevent.
import { daemonMeetsFloor, isDaemonVersionAtLeast, jinniMeetsFloor, reportedVersionOrNull } from '@bespok3d/contract'

// Why this package must not be installed on this printer, in the owner's terms, or null when it may.
export function packageFloorRefusal(
  packageName: string,
  declaredFloor: string | null,
  runningDaemonVersion: string | null,
): string | null {
  if (daemonMeetsFloor(runningDaemonVersion, declaredFloor)) return null

  return `${packageName} needs the Bespok3d daemon at ${declaredFloor} or newer, and this printer runs ` +
    `${runningDaemonVersion}. Update the daemon on this printer, then install ${packageName}.`
}

// The same question asked of the other half of the pair. The daemon package is the one that declares a
// jinni floor: sending a daemon that will not drive the support package already on the printer leaves
// that printer enrolled and unmanageable, so it is refused before a byte goes up rather than discovered
// afterwards from the printer's own refusal.
export function packageJinniFloorRefusal(
  packageName: string,
  declaredFloor: string | null,
  runningJinniVersion: string | null,
): string | null {
  if (jinniMeetsFloor(runningJinniVersion, declaredFloor)) return null

  return `${packageName} needs the printer support package at ${declaredFloor} or newer, and this printer ` +
    `runs ${runningJinniVersion}. Update the printer support package, then install ${packageName}.`
}

// The two versions actually running on a printer, each null when the printer did not report it.
export interface ReportedPair {
  daemonVersion: string | null
  jinniVersion: string | null
}

export interface DeclaredFloors {
  // The oldest daemon this printer's support package will work with, from the jinni's own manifest.
  minDaemonVersion: string | null
  // The oldest support package this daemon will drive, served by the daemon on capabilities.
  minJinniVersion: string | null
}

function daemonBelowJinniFloor(pair: ReportedPair, floors: DeclaredFloors): string | null {
  if (daemonMeetsFloor(pair.daemonVersion, floors.minDaemonVersion)) return null

  return `This printer's support package needs the Bespok3d daemon at ${floors.minDaemonVersion} or newer, ` +
    `and the daemon is ${pair.daemonVersion}. Update the daemon on this printer.`
}

function jinniBelowDaemonFloor(pair: ReportedPair, floors: DeclaredFloors): string | null {
  const jinniVersion = reportedVersionOrNull(pair.jinniVersion)
  if (!floors.minJinniVersion || !jinniVersion) return null
  if (isDaemonVersionAtLeast(jinniVersion, floors.minJinniVersion)) return null

  return `The Bespok3d daemon ${pair.daemonVersion ?? 'on this printer'} needs the printer support package at ` +
    `${floors.minJinniVersion} or newer, and this printer runs ${jinniVersion}. Update the printer support package.`
}

// Why this daemon and this support package must not run together, or null when they may. Both
// directions are asked and the older side is the one named, so the owner is never told to update the
// half that was already new enough.
export function pairRefusal(pair: ReportedPair, floors: DeclaredFloors): string | null {
  return daemonBelowJinniFloor(pair, floors) ?? jinniBelowDaemonFloor(pair, floors)
}
