// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export type PluginVars = Record<string, string>

// What the printer holds for a plugin: its saved values (none when it has never installed it), or
// 'unreadable' when it would not answer, which is not the same as holding nothing.
export type PrinterVars = PluginVars | 'unreadable'

// An app that never configured a plugin (a second computer, a cleared profile) holds none of its
// settings, and the printer refuses a required setting that arrives empty. The printer keeps the values
// it was last given, so those fill the gaps; a value this app holds is the user's latest word and wins.
// A setting neither holds takes the manifest's default.
//
// A printer that would not answer gets no defaults: it may hold a saved value for that setting, and a
// default sent in its place would overwrite what the user chose. Without them the printer still refuses
// a missing setting and says which, so nothing goes through on a guess.
export function varsToSend(appVars: PluginVars | undefined, printerVars: PrinterVars, defaults: PluginVars): PluginVars {
  if (printerVars === 'unreadable') return { ...(appVars ?? {}) }

  return { ...defaults, ...printerVars, ...(appVars ?? {}) }
}
