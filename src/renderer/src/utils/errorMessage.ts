// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A thrown value is `unknown`: an Error carries the human message on `.message`, while bare
// `String(err)` prints "Error: ..." for an Error and "[object Object]" for a plain object. Collapse
// every catch site onto one reader so the surfaced text is the message, not the wrapper.
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const IPC_WRAPPER = /^Error invoking remote method '[^']*':\s*(?:[A-Za-z]*Error:\s*)?/

// Electron wraps anything the main process throws as "Error invoking remote method 'x': Error: <what
// went wrong>" before the renderer ever sees it. The user reads the sentence the main process wrote,
// never the plumbing in front of it.
export function mainProcessMessage(err: unknown): string {
  return errorMessage(err).replace(IPC_WRAPPER, '')
}
