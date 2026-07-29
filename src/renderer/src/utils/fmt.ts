// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export function fmtCount(ct: number): string {
  if (ct >= 1000) return (ct / 1000).toFixed(ct >= 10000 ? 0 : 1) + 'k'

  return String(ct)
}
