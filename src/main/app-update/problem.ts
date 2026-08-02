// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Why an update read could not be answered, in the three shapes a reader can actually act on: nothing
// is published at this address, github.com never answered, or it answered with something that is not
// the release list. Everything the update path can fail with (a plain fetch, electron-updater's own
// downloader) collapses onto one of the three, so the renderer says it in the user's language and no
// raw http text ever reaches the screen.
export type UpdateProblem = 'notPublished' | 'unreachable' | 'unavailable'

export interface UpdateErrorPayload {
  problem: UpdateProblem
  // The original wording, for the log and for the update modal's technical note. Never the only thing
  // shown: the localized sentence comes from the problem.
  detail: string
}

const NOT_PUBLISHED = /\b404\b|Not Found/i
const UNREACHABLE = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|net::ERR|fetch failed|timed out|aborted/i

// electron-updater reports its failures as free text and nothing else, so the text is the only place
// the cause can be read from. Anything unrecognised is "github.com could not answer", which is the
// honest reading of an unexplained failure and never claims a cause that was not established.
export function updateProblemFromError(error: unknown): UpdateProblem {
  const wording = error instanceof Error ? error.message : String(error)
  if (NOT_PUBLISHED.test(wording)) return 'notPublished'
  if (UNREACHABLE.test(wording)) return 'unreachable'

  return 'unavailable'
}
