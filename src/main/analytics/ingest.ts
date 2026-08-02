// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The entire network surface of usage reporting: one POST, written out by hand rather than through a
// PostHog client library, so every byte that leaves the machine is visible in this file. There is no
// library present to turn autocapture, session recording or automatic pageviews on, which is why
// none of them can be on. The recorder host is the ingest endpoint; the dashboard host is a place
// the owner reads and is never addressed from the app.
const INGEST_URL = 'https://recorder.bespok3d.app/i/v0/e/'

// Short on purpose: an event is worth no user-visible delay, and an ingest that has not answered by
// now is one we drop rather than wait for.
const SEND_TIMEOUT_MS = 4000

// The host refuses an event that names no sender, and it keeps whatever it is given for as long as
// it keeps the event. So it is given one word, the same word from every install and on every event,
// which tells it nothing it can tell two machines apart by. A random value per install or per event
// would be exactly the thing being avoided: something that survives on a server and separates one
// person's use of the app from another's. There are two words rather than one only because the
// project's own development runs must not be read as users, and the choice between them is a single
// boolean decided once at start: nothing here can be handed a third word or a made-up one.
const SENDER_RELEASE = 'bespok3d'
const SENDER_DEVELOPMENT = 'bespok3d-dev'

// Turns off the host's own profile building. Without it the host would open a record keyed by the
// sender above and hang properties on it, which is a store about a person we have said we do not
// keep. Sent on every event, from here, so no event can be sent without it.
const NO_PERSON_PROFILE = { $process_person_profile: false }

export interface IngestEvent {
  name: string
  projectToken: string
  // False for a run from a working copy, so the project's own use of the app is one word apart from
  // its users' and can be read, or left out, on its own.
  releaseRun: boolean
  properties: Record<string, unknown>
}

export async function postEventToIngest(event: IngestEvent): Promise<void> {
  const response = await fetch(INGEST_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: event.projectToken,
      event: event.name,
      distinct_id: event.releaseRun ? SENDER_RELEASE : SENDER_DEVELOPMENT,
      properties: { ...event.properties, ...NO_PERSON_PROFILE },
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`the analytics host answered ${response.status}`)
}
