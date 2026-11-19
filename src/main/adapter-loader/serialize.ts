// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The renderer-facing view of one adapter: its definition with the enroll and op closures stripped,
// plus the jinni build this app would install for it.
import { offeredJinniBuild } from '../compat/jinni-baseline'
import type { AdapterDefinition, AdapterInfo } from './index'

export function serializeAdapter(adapter: AdapterDefinition | undefined): AdapterInfo | null {
  if (!adapter) return null
  const jinniBuild = offeredJinniBuild(adapter)

  return {
    id: adapter.id, title: adapter.title, vendor: adapter.vendor, version: adapter.version, restartSeconds: adapter.restartSeconds,
    jinniVersion: jinniBuild?.version, jinniPackage: adapter.jinniPackage, jinniFingerprint: jinniBuild?.fingerprint ?? undefined,
    description: adapter.description, icon: adapter.icon, defaults: adapter.defaults, envVars: adapter.envVars,
    enrollSteps: adapter.enrollSteps.map((step) => ({ id: step.id, label: step.label, detail: step.detail })),
  }
}
