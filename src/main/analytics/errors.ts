// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The only way a failure becomes an event. What goes out is the KIND of failure and the part of the
// app it happened in, and there is no third thing: no message, no stack, no file path, no url, no
// plugin or printer id. That is structural rather than careful. An error message is the one string in
// the app most likely to carry a path, a hostname or something the user typed, so the message never
// reaches a property at all: what is sent is cut at the first character a class name cannot contain,
// so a message is left with its first word and nothing else.
//
// Nothing here decides whether to send. Every event goes through reportEvent and inherits the one
// consent gate, so a user who said no is as silent about crashes as about everything else.
import { reportEvent } from './index'
import type { AnalyticsArea } from './events'

// Per kind of failure, per run. A loop that throws the same thing a thousand times says it a few
// times and then stops: the owner needs to know the failure happens, not to be billed for counting
// it, and a machine stuck in a retry must never turn into a machine hammering the ingest host.
const REPORTS_PER_KIND_PER_RUN = 3

// Long enough for any real class name and short enough that nothing else fits.
const LONGEST_CLASS_NAME = 40

// What a throw that carries no usable class is called. Also what an anonymous class becomes.
const UNNAMED_FAILURE = 'Error'

const reportsSoFar = new Map<string, number>()

// The class of what was thrown and nothing else. Anything that is not an Error has no class worth
// reporting, and guessing one from its contents is exactly the guess that leaks.
export function errorClassOf(thrown: unknown): string {
  if (!(thrown instanceof Error)) return UNNAMED_FAILURE

  return classNameOnly(thrown.constructor?.name ?? thrown.name)
}

export function reportErrorEvent(thrown: unknown, area: AnalyticsArea): void {
  sendErrorEvent(errorClassOf(thrown), area)
}

// The renderer is the one caller whose words are not our own code: it runs page scripts and, on a bad
// day, someone else's. So it does not get to say where the failure was, only what it was, and even
// that is cut the same way as everything else. The worst a page can do here is
// miscount its own crashes.
export function reportRenderFailure(errorClass: unknown): void {
  sendErrorEvent(classNameOnly(String(errorClass)), 'renderer')
}

function sendErrorEvent(errorClass: string, area: AnalyticsArea): void {
  if (!withinRunCap(`${errorClass}:${area}`)) return

  reportEvent('error_occurred', { error_class: errorClass, area })
}

// Counted per class AND area together: the same kind of failure in two parts of the app is two
// things the owner needs to see, and one of them must not use up the other's allowance.
function withinRunCap(kindOfFailure: string): boolean {
  const alreadySent = reportsSoFar.get(kindOfFailure) ?? 0
  if (alreadySent >= REPORTS_PER_KIND_PER_RUN) return false
  reportsSoFar.set(kindOfFailure, alreadySent + 1)

  return true
}

// A class name is one unbroken word, so the string is CUT at the first character a class name cannot
// contain rather than having the offending characters picked out of it. Stripping would have joined
// "/Users/someone/.ssh/id_rsa" back into one word and sent it; cutting keeps the first word and loses
// the rest, which is the only shape in which a path cannot survive the trip. Digits are kept after
// the first letter so a Base64Error stays itself instead of being filed under Base.
function classNameOnly(name: string): string {
  const leadingWord = /^[A-Za-z][A-Za-z0-9]*/.exec(name.trim())

  return leadingWord?.[0].slice(0, LONGEST_CLASS_NAME) ?? UNNAMED_FAILURE
}

// Tests only: the cap counts per run, and a test run is many runs in one process.
export function forgetErrorCounts(): void {
  reportsSoFar.clear()
}
