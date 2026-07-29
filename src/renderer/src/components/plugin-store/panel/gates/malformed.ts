// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { MALFORMED_PACKAGE_PREFIX, type MalformedPackageDetail } from '../../../../../../main/store/malformed-package'

export type { MalformedPackageDetail }

// True when errorMsg came from a daemon integrity refusal: the .b3 carried members its signed manifest
// does not vouch for (undeclared or escaping files, or a hash that did not match). Tests the shared
// prefix, not a class name, because Electron IPC keeps only the message string across the main/renderer
// boundary (mirrors refusal.ts). Never true for a network or ordinary daemon failure.
export function isMalformedPackage(errorMsg: string): boolean {
  return errorMsg.includes(MALFORMED_PACKAGE_PREFIX)
}

// The reason token plus offending paths an integrity refusal was thrown with, decoded from the JSON
// that rides after the prefix across IPC. Null when errorMsg is not a malformed-package message or its
// payload is unreadable, so the caller falls back to generic failure copy.
export function malformedPackageDetail(errorMsg: string): MalformedPackageDetail | null {
  const at = errorMsg.indexOf(MALFORMED_PACKAGE_PREFIX)
  if (at < 0) return null

  return parseDetail(errorMsg.slice(at + MALFORMED_PACKAGE_PREFIX.length))
}

function parseDetail(encoded: string): MalformedPackageDetail | null {
  const parsed = tryParseJson(encoded)
  if (!isRecord(parsed)) return null
  const { reason, paths } = parsed
  if (typeof reason !== 'string' || !Array.isArray(paths)) return null

  return { reason, paths: paths.map(String) }
}

function tryParseJson(encoded: string): unknown {
  try {
    return JSON.parse(encoded)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
