// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer } from '../types'

export type SetPrinters = (updater: (prev: Printer[]) => Printer[]) => void

export function applyToId(id: string, patch: Partial<Printer>): (prev: Printer[]) => Printer[] {
  return (prev) => prev.map((saved) => saved.id === id ? { ...saved, ...patch } : saved)
}

// Patches one printer in the list AND persists only the changed fields, the shape the icon and
// ssh-toggle handlers each hand-rolled. A field-level patch never carries a daemon credential, so it
// cannot clobber the token or cert the main process holds; persists nothing when the id is absent.
export function patchAndSave(set: SetPrinters, id: string, patch: Partial<Printer>): void {
  set((prev) => {
    const target = prev.find((printer) => printer.id === id)
    if (target) window.b3d.printers.patch(id, patch)

    return applyToId(id, patch)(prev)
  })
}
