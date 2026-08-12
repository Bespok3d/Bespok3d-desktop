// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The only way a failure becomes an event. What goes out is the KIND of failure, the part of the app
// it happened in, which step of enrolling it broke on, and the status a printer answered with. There
// is no fifth thing: no message, no stack, no file path, no url, no plugin or printer id. That is
// structural rather than careful. An error message is the one string in the app most likely to carry
// a path, a hostname or something the user typed, so the message never reaches a property at all:
// what is sent is cut at the first character a name cannot contain, so a message is left with its
// first word and nothing else.
//
// Nothing here decides whether to send. Every event goes through reportEvent and inherits the one
// consent gate, so a user who said no is as silent about crashes as about everything else.
import { reportEvent } from './index'
import type { AnalyticsArea } from './events'

// Per kind of failure, per run. A loop that throws the same thing a thousand times says it a few
// times and then stops: the owner needs to know the failure happens, not to be billed for counting
// it, and a machine stuck in a retry must never turn into a machine hammering the ingest host.
const REPORTS_PER_KIND_PER_RUN = 3

// Long enough for any real class name or step id, and short enough that nothing else fits.
const LONGEST_NAME = 40

// What a throw that carries no usable class is called. Also what an anonymous class becomes.
const UNNAMED_FAILURE = 'Error'

// A class name is one unbroken word. Digits are kept after the first letter so a Base64Error stays
// itself instead of being filed under Base.
const CLASS_NAME_SHAPE = /^[A-Za-z][A-Za-z0-9]*/

// A step id is letters and dashes and NOTHING else, which is stricter than the step ids we ship
// need: an adapter is somebody else's code, and a digit ending the word is what makes an address, a
// serial, a uuid or a path unable to survive being interpolated into one. The cost is that
// deploy-s99 arrives as deploy-s, which is still not any other step.
const STEP_NAME_SHAPE = /^[a-z][a-z-]*/

// The range an HTTP status lives in. A number outside it is some other number that happened to be
// called statusCode, and is not sent.
const LOWEST_HTTP_STATUS = 100
const HIGHEST_HTTP_STATUS = 599

const reportsSoFar = new Map<string, number>()

// The class of what was thrown and nothing else. Anything that is not an Error has no class worth
// reporting, and guessing one from its contents is exactly the guess that leaks.
export function errorClassOf(thrown: unknown): string {
  if (!(thrown instanceof Error)) return UNNAMED_FAILURE

  return classNameOnly(thrown.constructor?.name ?? thrown.name)
}

// The step is the caller's, because only the caller knows which one it was running. It is still cut
// here rather than there, so a step id from an adapter we did not write is cleaned by the same code
// that cleans everything else, once, in the place that does the sending.
export function reportErrorEvent(thrown: unknown, area: AnalyticsArea, stepId?: string): void {
  sendErrorEvent(errorClassOf(thrown), area, stepNameOnly(stepId), httpStatusOf(thrown))
}

// The renderer is the one caller whose words are not our own code: it runs page scripts and, on a bad
// day, someone else's. So it does not get to say where the failure was, only what it was, and even
// that is cut the same way as everything else. The worst a page can do here is
// miscount its own crashes.
export function reportRenderFailure(errorClass: unknown): void {
  sendErrorEvent(classNameOnly(String(errorClass)), 'renderer')
}

function sendErrorEvent(errorClass: string, area: AnalyticsArea, step?: string, statusCode?: number): void {
  if (!withinRunCap(`${errorClass}:${area}:${step ?? ''}:${statusCode ?? ''}`)) return

  reportEvent('error_occurred', {
    error_class: errorClass,
    area,
    ...(step ? { step } : {}),
    ...(statusCode ? { status_code: statusCode } : {}),
  })
}

// Counted per class AND area AND step AND status together: the same kind of failure in two parts of
// the app, or on two steps of enrolling, is two things the owner needs to see, and one of them must
// not use up the other's allowance.
function withinRunCap(kindOfFailure: string): boolean {
  const alreadySent = reportsSoFar.get(kindOfFailure) ?? 0
  if (alreadySent >= REPORTS_PER_KIND_PER_RUN) return false
  reportsSoFar.set(kindOfFailure, alreadySent + 1)

  return true
}

// A failure that carried a number, and only if that number is an HTTP status: the daemon's own
// failures carry the status the printer answered with, and 401, 409 and 500 are three different
// problems that all arrive as one word without it. Read off the shape rather than off the class, so
// this stays a leaf that imports no part of the app it reports on.
function httpStatusOf(thrown: unknown): number | undefined {
  const carried = (thrown as { statusCode?: unknown } | null | undefined)?.statusCode
  if (typeof carried !== 'number' || !Number.isInteger(carried)) return undefined

  return isHttpStatus(carried) ? carried : undefined
}

function isHttpStatus(status: number): boolean {
  return status >= LOWEST_HTTP_STATUS && status <= HIGHEST_HTTP_STATUS
}

// The string is CUT at the first character the name cannot contain rather than having the offending
// characters picked out of it. Stripping would have joined "/Users/someone/.ssh/id_rsa" back into one
// word and sent it; cutting keeps the first word and loses the rest, which is the only shape in which
// a path cannot survive the trip.
function classNameOnly(name: string): string {
  return leadingWordOf(name, CLASS_NAME_SHAPE) ?? UNNAMED_FAILURE
}

// A step that cuts down to nothing is sent as nothing. There is no stand-in word for it, because a
// step nobody can name says only that the adapter named it something strange, which is not a fact
// about a failure and not worth a property.
function stepNameOnly(stepId: string | undefined): string | undefined {
  return leadingWordOf((stepId ?? '').toLowerCase(), STEP_NAME_SHAPE)
}

function leadingWordOf(text: string, shape: RegExp): string | undefined {
  return shape.exec(text.trim())?.[0].slice(0, LONGEST_NAME)
}

// Tests only: the cap counts per run, and a test run is many runs in one process.
export function forgetErrorCounts(): void {
  reportsSoFar.clear()
}
