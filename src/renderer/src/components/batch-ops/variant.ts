// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The four batch operations, named once. Every piece of the batch UI (the busy view, the results
// report, the refusal) keys its copy off this, so a variant added here cannot be missed by one of them.
export type BatchVariant = 'recovery' | 'update' | 'install' | 'uninstall'

// What the printer refused, and the sentence it refused with. One batch runs at a time, so the app
// holds one of these; each modal shows the failure only when it is that modal's own operation.
export interface BatchFailure {
  variant: BatchVariant
  reason: string
}
