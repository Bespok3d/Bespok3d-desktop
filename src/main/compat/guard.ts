// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The compatibility floor, enforced where the bytes actually leave for the printer.
//
// It used to be checked in one place only: the store card's button. Every other way a package reaches
// a printer walked straight past it. Recovery after a firmware update, a bundled first install, a
// dependency pulled in by another plugin and a sideloaded .b3 all install through the same code the
// card does, and none of them go through the card. Guarding the install path closes all of them at
// once, and the card now reaches the same verdict rather than owning it.
import type { PrinterRecord } from '../printers'
import { declaredDaemonFloor, declaredJinniFloor } from '@bespok3d/contract'
import { packageFloorRefusal, packageJinniFloorRefusal } from './floors'
import { askPrinterCompat } from './reported'

// A package that does not fit the pair this printer is running. Its own class so the install path can
// tell a refusal it made itself from one the printer sent back.
export class PackageDoesNotFitPrinter extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackageDoesNotFitPrinter'
  }
}

export interface PackageFloors {
  name: string
  min_daemon_version?: unknown
  min_jinni_version?: unknown
}

// Refuse before a byte is sent when either half of this printer is older than the package demands. A
// package declares the oldest daemon it runs against and the oldest support package it will drive, and
// BOTH have to hold: a daemon sent to a printer whose support package it will then refuse to drive
// leaves that printer enrolled and unmanageable, which is the same broken pair from the other side.
//
// Both versions are read from the printer now, not from the record, in one pass, and a printer that
// will not answer is not refused.
export async function assertPrinterMeetsPackageFloors(
  record: PrinterRecord,
  entry: PackageFloors,
): Promise<void> {
  const daemonFloor = declaredDaemonFloor(entry)
  const jinniFloor = declaredJinniFloor(entry)
  if (!daemonFloor && !jinniFloor) return

  const { pair } = await askPrinterCompat(record)
  const refusal = packageFloorRefusal(entry.name, daemonFloor, pair.daemonVersion)
    ?? packageJinniFloorRefusal(entry.name, jinniFloor, pair.jinniVersion)
  if (refusal) throw new PackageDoesNotFitPrinter(refusal)
}
