// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The one door to the analytics host. Nothing else in the app may address it, so every condition
// that has to hold before a byte leaves the machine holds in one readable place: the user has said
// yes, this run is not an automated one, and this build was given a project key. A run from a
// working copy does report, under its own sender word, so the project can see its own activity
// without it being read as somebody's install. Consent is re-read from disk on every event, never cached at
// start, which is what makes the Settings switch land inside the same app run in both directions.
//
// Nothing is ever queued. An event that cannot go out now is dropped and written to this machine's
// own log, so nothing accumulates on disk waiting for consent, for a network, or for a restart.
//
// Every path here swallows its own throw. Usage reporting is attached to real user actions, and a
// reporting fault must never crash the app, break the action it rode along with, or reach the user.
import { loadSettings } from '../settings'
import { postEventToIngest } from './ingest'
import { ANALYTICS_EVENT_NAMES } from './events'
import { sendingClientProperties } from './sending-client'
import type { AnalyticsEventName, AnalyticsEventProperties } from './events'

var analyticsBuild: AnalyticsBuild | null = null

interface AnalyticsBuild {
  // Injected from the environment when the build is made. Empty means this build can never send.
  projectToken: string
  appVersion: string
  // False for an automated launch, whose events would be a test harness measuring itself.
  countThisRun: boolean
  // False for a run from a working copy. A development run is still reported, under its own word, so
  // the project can see its own activity without it being read as somebody's install.
  releaseRun: boolean
  // What the machine itself is set to. The user's own choice of language wins over it when they have
  // made one, and that is read per event rather than here, because it can change mid run.
  systemLanguage: string
}

export function startAnalytics(started: AnalyticsBuild): void {
  analyticsBuild = started
  if (started.projectToken) return
  console.info('[analytics] this build carries no project key, so usage reporting is inert')
}

export function reportEvent<Name extends AnalyticsEventName>(
  name: Name,
  properties: AnalyticsEventProperties[Name],
): void {
  try {
    sendWhenAllowed(name, properties)
  } catch (fault) {
    logDroppedEvent(name, fault)
  }
}

// Whether anything would in fact be reported if the user agreed. A build made without a project key
// and a run the project does not count are both inert, and asking someone's permission for something
// that cannot happen either way is a question with no purpose behind it.
export function usageReportingIsLive(): boolean {
  return Boolean(analyticsBuild?.projectToken) && analyticsBuild?.countThisRun === true
}

function sendWhenAllowed(name: AnalyticsEventName, properties: object): void {
  const permitted = analyticsBuild
  if (!permitted || !usageReportingIsLive()) return
  // The published list of what Bespok3d collects is written from ANALYTICS_EVENT_NAMES, so a name
  // that is not in it is a name no user was ever told about. The compiler already refuses one at a
  // typed call site; this refuses one arriving from anywhere that is not type checked.
  if (!ANALYTICS_EVENT_NAMES.includes(name)) return
  if (loadSettings().analyticsConsent !== 'granted') return
  const client = sendingClientProperties(permitted.systemLanguage)
  const carried = { ...properties, ...client, app_version: permitted.appVersion }
  const sending = { name, projectToken: permitted.projectToken, releaseRun: permitted.releaseRun }
  postEventToIngest({ ...sending, properties: carried }).catch((fault) => logDroppedEvent(name, fault))
}

// The trace R-SEND-10 asks for, and the end of the line: a delivery failure is never turned into an
// error event of its own, which would be the reporter reporting itself into a loop.
function logDroppedEvent(name: string, fault: unknown): void {
  console.warn(`[analytics] dropped ${name}: ${String(fault)}`)
}
