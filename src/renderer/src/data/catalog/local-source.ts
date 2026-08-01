// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A catalog entry is "local" when its source registry is a file on this machine (the bundled dev
// index, or a package the user dropped on the app) rather than a published list (github:/http url).
//
// A leaf: what is local decides what the store may say about a version, so the mapper, the install
// gate and the panel all read this one predicate and none of them owns it.
export function isLocalRegistry(registryUrl: string): boolean {
  return !/^(github:|https?:)/.test(registryUrl)
}
