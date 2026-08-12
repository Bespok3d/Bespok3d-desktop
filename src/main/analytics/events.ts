// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The complete set of events this app may send, and the exact property keys each one may carry.
// reportEvent resolves its property type from the event name, so a key that is not declared here is
// a compile error at the call site rather than a runtime check: the open-ended promise "no personal
// data is sent" becomes a closed set the compiler holds. Adding an event is an edit to this file and
// nowhere else. The properties every event carries regardless (the app version, and what kind of
// copy of Bespok3d sent it: the client, the operating system and the language) are attached by the
// sender and are absent from this file, so no call site can restate them or disagree about them.

// An event that carries nothing of its own. Written as a map whose every value is impossible rather
// than as an empty object type, because an empty object type accepts anything: this one accepts {}
// and turns any stray property into a compile error, which is the whole point of the allowlist.
type NoPropertiesOfItsOwn = Record<string, never>

// The parts of the app a break can be attributed to. A closed list on purpose: an area is a word the
// project already uses for a part of itself, so the numbers stay comparable run to run, and free text
// from anywhere (least of all the renderer) can never become a new one. The list is written once, as
// values, and the type is read back off it, so what checks an area at runtime and what checks it at
// compile time cannot come to disagree.
export const ANALYTICS_AREAS = ['renderer', 'main-process', 'enrollment', 'plugin-install'] as const

export type AnalyticsArea = (typeof ANALYTICS_AREAS)[number]

// Every event this app may send, written once as values so the sender can check a name against the
// list at runtime and the published taxonomy can be compared against the same list rather than
// against a second copy of it. Two lists that agree prove only that they agree; this one is the list
// the app obeys. The name type is read back off it, so an event that is not named here cannot be
// declared below and cannot be sent.
export const ANALYTICS_EVENT_NAMES = [
  'app_launched',
  'printer_enrolled',
  'plugin_installed',
  'app_updated',
  'error_occurred',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number]

export interface AnalyticsEventProperties extends Record<AnalyticsEventName, object> {
  // Once per app start. It is a count of launches, never of installs or of people: nothing on an
  // event tells two machines apart, so two launches from one machine and one each from two look the
  // same on purpose.
  app_launched: NoPropertiesOfItsOwn
  // Sent when enrollment completed, never when it merely started.
  printer_enrolled: NoPropertiesOfItsOwn
  // Sent when the package is installed and active on the printer, never when the install began.
  plugin_installed: NoPropertiesOfItsOwn
  // The version the app came FROM, which is what separates an update from a brand-new install: a
  // first run has no previous version and therefore sends no update event at all.
  app_updated: { previous_version: string }
  // What kind of failure, where, and the two things that tell one apart from the next without any
  // of them being about the person it happened to. A message or a stack is still never sent: those
  // carry file paths, printer addresses and the names of plugins a user wrote.
  // `step`: which part of enrolling broke, in the adapter's own word for it, cut to letters and
  // dashes so nothing that identifies a machine can be interpolated into one.
  // `status_code`: the HTTP status a printer's daemon answered with, which is a number in 100 to 599
  // and can be nothing else. Both are absent when the failure had neither.
  error_occurred: { error_class: string; area: AnalyticsArea; step?: string; status_code?: number }
}
