// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginConfigField } from '../../../data/types'
import { typeDefault } from '../../../data/plugin-vars'

// A complete value per field: the saved/known value when present, else the field default, else the
// type default. Used to seed install forms and edit drafts, so a partial known map still yields a
// complete set of vars to send.
export function initialConfigValues(
  fields: PluginConfigField[],
  saved: Record<string, string> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [field.key, saved?.[field.key] ?? field.default ?? typeDefault(field)]),
  )
}

export function configComplete(fields: PluginConfigField[], values: Record<string, string>): boolean {
  return fields.every((field) => !field.required || (values[field.key] ?? '').trim().length > 0)
}

// Human-readable labels of the required fields still left empty, for the "why is Install blocked" note.
export function missingRequiredFields(fields: PluginConfigField[], values: Record<string, string>): string[] {
  return fields.filter((field) => field.required && (values[field.key] ?? '').trim().length === 0).map((field) => field.label)
}
