// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MergedEntry } from '../registry/model'
import { isRecord } from '../is-record'
import type { PluginVars } from './vars-to-send'

// The same text the daemon writes a setting as (user_vars._setting_as_text): a toggle's JSON true is
// the manifest's "true", and a missing value is an empty string.
function settingAsText(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null || value === undefined) return ''

  return String(value)
}

function recordsIn(list: unknown): Record<string, unknown>[] {
  return Array.isArray(list) ? list.filter(isRecord) : []
}

function declaredVariables(entry: MergedEntry): Record<string, unknown>[] {
  return isRecord(entry.requires) ? recordsIn(entry.requires.variables) : []
}

function requiredNames(entry: MergedEntry): Set<string> {
  return new Set(declaredVariables(entry).filter((variable) => Boolean(variable.required)).map((variable) => String(variable.name)))
}

function hasTextKey(field: Record<string, unknown>, keyName: string): boolean {
  return typeof field[keyName] === 'string'
}

// A required setting's default is only a placeholder on the form: sending it would install against a
// dummy value instead of letting the printer refuse the missing setting.
function settingDefaults(entry: MergedEntry): PluginVars {
  const required = requiredNames(entry)
  const fields = recordsIn(entry.config).filter((field) => hasTextKey(field, 'key') && 'default' in field && !required.has(String(field.key)))

  return Object.fromEntries(fields.map((field) => [String(field.key), settingAsText(field.default)]))
}

function variableDefaults(entry: MergedEntry): PluginVars {
  const variables = declaredVariables(entry).filter((variable) => hasTextKey(variable, 'name') && 'default' in variable)

  return Object.fromEntries(variables.map((variable) => [String(variable.name), settingAsText(variable.default)]))
}

// What the plugin's manifest says each setting is when nobody has said anything about it. A daemon from
// 0.15.0 on fills these in itself; an older one leaves a setting nobody sent without a value and the plugin
// refuses to install, so the app sends them. The rules are the daemon's own (with_declared_defaults).
export function declaredDefaults(entry: MergedEntry): PluginVars {
  return { ...settingDefaults(entry), ...variableDefaults(entry) }
}
