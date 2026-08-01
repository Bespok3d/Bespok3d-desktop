// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The parts of the app that are built but not ready to ship: the Create workbench and the Keys and
// Labs settings panes. A dev run (and the catalog, and the tests) shows them; a release build hides
// them. B3D_DEV_FEATURES=1 in a packaged app's environment brings them back, so they can still be
// exercised from a real build without a source change.
export function showsUnreleasedFeatures(): boolean {
  return import.meta.env.DEV || window.b3d.unreleasedFeaturesForced
}
