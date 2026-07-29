// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Marks a thrown message as a security refusal rather than a generic failure. Electron's IPC wrapping
// keeps only the Error's message string intact across the main/renderer boundary (the class name
// survives by accident of its wrapping format, not as a contract), so the renderer tells a refusal
// apart from a daemon timeout by testing for this prefix, never by sniffing 'PackageRefusedError'.
//
// Kept free of verify-package.ts's openpgp import chain on purpose: the renderer imports this constant
// directly (plugin-store/panel/gates/refusal.ts), and openpgp's node build breaks when it rides along
// into the renderer test bundle.
export const PACKAGE_REFUSED_PREFIX = 'PACKAGE_REFUSED: '

// Thrown when a package must not be installed. Distinct from a transport or daemon failure: nothing
// went wrong with the machinery, the package itself failed a security check and retrying will not help.
export class PackageRefusedError extends Error {
  constructor(message: string) {
    super(`${PACKAGE_REFUSED_PREFIX}${message}`)
  }
}
