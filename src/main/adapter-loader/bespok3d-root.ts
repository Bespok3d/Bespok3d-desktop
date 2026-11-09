// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AdapterDefinition } from '.'

// Where every adapter so far keeps bespok3d's files, for a printer whose adapter is not loaded.
const DEFAULT_BESPOK3D_ROOT = '/userdata/bespok3d'

// Where bespok3d keeps its files on a printer: a fact of the printer model, so its adapter says it.
export function bespok3dRootOn(adapter: AdapterDefinition | undefined): string {
  return adapter?.envVars.find((envVar) => envVar.name === 'BESPOK3D')?.value || DEFAULT_BESPOK3D_ROOT
}
