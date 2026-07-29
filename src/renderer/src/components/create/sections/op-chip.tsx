// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export function OpChip({ op, subtle }: { op: string; subtle?: boolean }) {
  return <span className={subtle ? 'op-chip subtle' : 'op-chip'}>{op}</span>
}
