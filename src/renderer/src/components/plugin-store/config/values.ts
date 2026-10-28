// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginConfigField } from '../../../data/types'
import { typeDefault } from '../../../data/plugin-vars'

// A manifest is JSON and a printer reports its saved vars as JSON, so a `number` or `toggle` field
// arrives carrying a real number or boolean however the string type below reads. Every screen that
// reads a config value treats it as text, so the value is made text HERE, at the one door all of
// them enter by, rather than at each of the four that would otherwise have to remember.
function configText(rawValue: unknown): string {
  return typeof rawValue === 'string' ? rawValue : String(rawValue)
}

// A complete value per field: the saved/known value when present, else the field default, else the
// type default. Used to seed install forms and edit drafts, so a partial known map still yields a
// complete set of vars to send.
export function initialConfigValues(
  fields: PluginConfigField[],
  saved: Record<string, string> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      configText(saved?.[field.key] ?? field.default ?? typeDefault(field)),
    ]),
  )
}

export function configComplete(fields: PluginConfigField[], values: Record<string, string>): boolean {
  return fields.every((field) => !field.required || (values[field.key] ?? '').trim().length > 0)
}

// Human-readable labels of the required fields still left empty, for the "why is Install blocked" note.
export function missingRequiredFields(fields: PluginConfigField[], values: Record<string, string>): string[] {
  return fields.filter((field) => field.required && (values[field.key] ?? '').trim().length === 0).map((field) => field.label)
}

// What an Update of an installed plugin sends from its form: the values the user saved or changed
// there. A value the form only shows as its seed default stays out, so the printer keeps the setting
// it already runs instead of having it overwritten by the manifest default.
export function userGivenValues(
  formValues: Record<string, string>,
  seedValues: Record<string, string>,
  saved: Record<string, string> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(formValues).filter(([key, value]) => saved?.[key] !== undefined || value !== seedValues[key]),
  )
}
