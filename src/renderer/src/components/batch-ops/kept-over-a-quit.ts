// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BatchResult } from '../../../../main/daemon-client/batch-result'
import { readStoredJson, writeStoredJson } from '../common/hooks/useLocalStorageState'

// What the app still owes the user about a printer is kept where it outlives the app, not in its
// memory: the user may quit the app before it is paid, and it must still be paid on the next launch.
// Each is kept per printer, so removing the printer takes all of its own with it.

// The check a recover left to the restart the user makes.
export const CHECKS_LEFT_KEY = 'b3d.checksLeftToTheirRestart'
// The report of the plugins a reactivate left off, held until the window on the printer's reboot is gone.
export const HELD_REPORTS_KEY = 'b3d.reportsHeldOverTheReboot'

// heldAt tells one held report from another for the same printer, so a report a later reactivate held
// is never taken for the one an earlier run of the app left behind. It is compared, never ordered.
export interface HeldReport {
  reapplied: BatchResult
  heldAt: number
}

// A key added to EVERY_KEPT_KEY without saying here what it keeps does not compile.
interface KeptByKey {
  [CHECKS_LEFT_KEY]: BatchResult
  [HELD_REPORTS_KEY]: HeldReport
}

const EVERY_KEPT_KEY = [CHECKS_LEFT_KEY, HELD_REPORTS_KEY] as const

type KeptKey = (typeof EVERY_KEPT_KEY)[number]

export function keptByPrinter<Key extends KeptKey>(key: Key): Map<string, KeptByKey[Key]> {
  return new Map(readStoredJson<[string, KeptByKey[Key]][]>(key, []))
}

export function keptFor<Key extends KeptKey>(key: Key, printerId: string): KeptByKey[Key] | undefined {
  return keptByPrinter(key).get(printerId)
}

// A new one for the printer replaces the one it had.
export function keepFor<Key extends KeptKey>(key: Key, printerId: string, kept: KeptByKey[Key]): void {
  writeStoredJson(key, [...keptByPrinter(key).set(printerId, kept)])
}

export function forgetFor(key: KeptKey, printerId: string): void {
  const keptByThePrinters = keptByPrinter(key)
  if (!keptByThePrinters.has(printerId)) return
  keptByThePrinters.delete(printerId)
  writeStoredJson(key, [...keptByThePrinters])
}

export function forgetAllKeptFor(printerId: string): void {
  EVERY_KEPT_KEY.forEach((key) => forgetFor(key, printerId))
}
