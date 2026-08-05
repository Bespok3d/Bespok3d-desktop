// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The printer subsystem, split by concern: record (types + the renderer-safe projection), store
// (userData persistence + the field-level merge write), captures (per-plugin log-capture list),
// probe (network reachability + the connection-ladder grading). This barrel is the public surface.
export type {
  EnrollmentLog, EnrollmentLogStep, DriftReport, PrinterProblem, PrinterRecord, PublicPrinterRecord, ConnectionReach,
} from './record'
export { toPublicRecord } from './record'
export { savePrinter, loadPrinters, loadPublicPrinters, updatePrinter, removePrinter } from './store'
export { mergeCapture, appendPluginCapture, pluginCaptures } from './captures'
export { pingPrinter, checkDaemon, checkSshOpen, checkMoonraker, gradeReach, probeService, probeServiceUrl } from './probe'
export { resolveLiveAddress, knownAddresses } from './resolve'
