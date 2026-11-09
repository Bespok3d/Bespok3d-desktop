// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AdapterDefinition, EnrollStep } from '.'

// A step the app runs by name, from the adapter's enrollment order or its maintenance steps. An adapter
// that does not have it answers nothing.
export function findAdapterStep(adapter: AdapterDefinition, stepId: string): EnrollStep | undefined {
  return [...adapter.enrollSteps, ...(adapter.opSteps ?? [])].find((candidate) => candidate.id === stepId)
}
