// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Daemon and jinni compatibility: what the printer reports, what a package demands, and what the app
// refuses when the two do not meet.
export { packageFloorRefusal, packageJinniFloorRefusal, pairRefusal } from './floors'
export type { ReportedPair, DeclaredFloors } from './floors'
export { reportedDaemonVersion, askPrinterCompat } from './reported'
export type { PrinterCompatFacts } from './reported'
export { assertPrinterMeetsPackageFloors, PackageDoesNotFitPrinter } from './guard'
export type { PackageFloors } from './guard'
export { firstOverlapRefusal } from './overlap'
export {
  DaemonMoveRefused,
  assertNotADaemonDowngrade,
  assertKnownPrinterNotDowngraded,
  assertPrinterNotPrinting,
  assertPairLandedTogether,
} from './move-guard'
