// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Public surface of the printers data module. Concerns live in sibling files: record (Printer<->record
// mapping), status (status derivation + downgrade hysteresis), address (discovered-address reconcile),
// list (in-list patch + persist), probe (the connection-ladder ping), build (add-form -> Printer),
// updates (daemon/jinni version-lag derivation, shared by the header dropdown and the settings row).
export { toPrinter, toRecord } from './record'
export { resolvedStatus, statusAfterProbe, statusDotClass } from './status'
export { reconcileDiscoveredAddress } from './address'
export { applyToId, patchAndSave } from './list'
export { pingAndUpdate, refreshEndpoints, resetPrinterProbe } from './probe'
export { buildPrinter } from './build'
export { jinniLags, pendingUpdates, updateCallout } from './updates'
export type { PendingUpdates, UpdateCalloutKind } from './updates'
