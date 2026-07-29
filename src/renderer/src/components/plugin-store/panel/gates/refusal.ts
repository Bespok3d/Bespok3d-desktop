// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PACKAGE_REFUSED_PREFIX } from '../../../../../../main/store/package-refused'

// True when errorMsg came from a security refusal (a tampered/unsigned/downgraded package), never from
// a network or daemon failure. Tests for the shared prefix, not the class name: Electron's IPC wrapping
// keeps only the message string intact across the main/renderer boundary.
export function isPackageRefusal(errorMsg: string): boolean {
  return errorMsg.includes(PACKAGE_REFUSED_PREFIX)
}

// The already-user-facing sentence a refusal was thrown with, stripped of the prefix and whatever
// Electron IPC wrapping sits in front of it. Only meaningful when isPackageRefusal(errorMsg) is true.
export function refusalReason(errorMsg: string): string {
  const [, reason] = errorMsg.split(PACKAGE_REFUSED_PREFIX)

  return reason ?? errorMsg
}
