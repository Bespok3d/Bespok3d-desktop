// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
function cx(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(' ')
}

export default cx
