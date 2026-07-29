// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export const PUBLISHER_REPO = 'bespok3d-publisher'

export function keyFilePath(fingerprint: string): string {
  return `keys/${fingerprint}/key.asc`
}
