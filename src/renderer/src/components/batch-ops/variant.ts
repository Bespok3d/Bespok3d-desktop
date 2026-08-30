// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The six batch operations, named once. Every piece of the batch UI (the busy view, the results
// report, the refusal) keys its copy off this, so a variant added here cannot be missed by one of them.
// `migration` is a plugin retiring into a set (it comes off, the set goes on); `migration-in-place` is
// a plugin keeping its id and changing what it does (it stays, updated over the top). The user reads a
// different ending for each, so they are different variants and not one with a flag.
export type BatchVariant = 'recovery' | 'update' | 'install' | 'uninstall' | 'migration' | 'migration-in-place'

// What the printer refused, and the sentence it refused with. One batch runs at a time, so the app
// holds one of these; each modal shows the failure only when it is that modal's own operation.
export interface BatchFailure {
  variant: BatchVariant
  reason: string
  // Which printer refused, so a refusal that only re-enrolling can clear can offer that re-enrollment.
  printerId: string
}
