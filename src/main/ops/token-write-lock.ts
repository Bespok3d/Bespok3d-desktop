// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENROLLMENT_ALREADY_RUNNING, RESET_ACCESS_ALREADY_RUNNING } from './reset-access-busy'

// A reset of access, an access request and an enrollment each give the printer a new token and store it
// here. Whichever stores last is the token this computer keeps, so they must not cross on one printer.
const resetsRunning = new Set<string>()
const enrollmentsRunning = new Map<string, number>()
const requestsRunning = new Map<string, Promise<unknown>>()

// A reset or an access request is refused while a reset or an enrollment runs on the printer.
function whyATokenWriteMustWait(printerId: string): string | undefined {
  if (resetsRunning.has(printerId)) return RESET_ACCESS_ALREADY_RUNNING
  if (enrollmentsRunning.has(printerId)) return ENROLLMENT_ALREADY_RUNNING

  return undefined
}

// One reset per printer at a time: two would each write their own token, and the one stored last here
// need not be the one the printer kept. A second reset is refused, never queued, so it cannot undo the first.
// An enrollment takes minutes and stores its own token at its end, so a reset is refused while one runs.
// A reset lets a running access request store its token first, so the reset's token is the one kept.
export async function runResetAlone(printerId: string, reset: () => Promise<void>): Promise<void> {
  const refusal = whyATokenWriteMustWait(printerId)
  if (refusal) throw new Error(refusal)
  resetsRunning.add(printerId)
  try {
    // A request's own failure is told to whoever asked for it; the reset only waits for it to end.
    await requestsRunning.get(printerId)
    await reset()
  } finally {
    resetsRunning.delete(printerId)
  }
}

function forgetEndedRequests(printerId: string, requestsSoFar: Promise<unknown>): void {
  if (requestsRunning.get(printerId) === requestsSoFar) requestsRunning.delete(printerId)
}

// Each request chains onto the ones already running, so a reset or an enrollment waits for all of them,
// not only the newest.
export function runRequestAlone<Answer>(printerId: string, request: () => Promise<Answer>): Promise<Answer> {
  const refusal = whyATokenWriteMustWait(printerId)
  if (refusal) return Promise.reject(new Error(refusal))
  const running = request()
  const requestsSoFar = Promise.allSettled([requestsRunning.get(printerId), running])
  requestsRunning.set(printerId, requestsSoFar)
  void requestsSoFar.then(() => forgetEndedRequests(printerId, requestsSoFar))

  return running
}

// Counted, not flagged: a retry can start while the attempt before it is still ending.
function countEnrollment(printerId: string, change: number): void {
  const stillRunning = (enrollmentsRunning.get(printerId) ?? 0) + change
  if (stillRunning > 0) enrollmentsRunning.set(printerId, stillRunning)
  else enrollmentsRunning.delete(printerId)
}

// An enrollment lets a running access request store its token first, so the enrollment's token is the one kept.
export async function runEnrollmentAlone<Outcome>(printerId: string, enrollment: () => Promise<Outcome>): Promise<Outcome> {
  if (resetsRunning.has(printerId)) throw new Error(RESET_ACCESS_ALREADY_RUNNING)
  countEnrollment(printerId, 1)
  try {
    await requestsRunning.get(printerId)

    return await enrollment()
  } finally {
    countEnrollment(printerId, -1)
  }
}
