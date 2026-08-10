// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Which daemon version this build expects, read from the daemon package the build actually ships.
// It used to be copied at build time out of a sibling checkout's version.py, which could name a
// version this build does not carry; reading the shipped catalogue means the version the app names is
// by construction the version it would install. Kept free of any electron import so the preload
// script, the e2e specs and the main process can all read it the same way.
import { shippedPackageVersion } from '../registry/shipped-version'

export const DAEMON_PACKAGE = 'bespok3d-daemon'

export function daemonVersionInRegistry(registryDir: string): string {
  const shipped = shippedPackageVersion(registryDir, DAEMON_PACKAGE)
  if (!shipped) throw new Error(`this build ships no "${DAEMON_PACKAGE}" package, so it cannot say which daemon version it expects`)

  return shipped
}
