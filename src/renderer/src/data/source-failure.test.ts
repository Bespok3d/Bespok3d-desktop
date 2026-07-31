// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// An empty store must say which thing went wrong and offer the sign-in only when signing in is what
// fixes it. Offering it to someone whose machine cannot reach GitHub sends him round a loop with no
// end, and saying "sign in" when the real cause is a spent anonymous request ration tells him to fix
// something that is not broken.
import { describe, it, expect } from 'vitest'
import type { SourceRow, SourceFailureReason } from './types'
import { emptyStoreReason, offersSignIn, signInWouldReach } from './source-failure'

function failedSource(reason: SourceFailureReason): SourceRow {
  return { url: 'https://lists.example.invalid/index.json', label: 'example/list', name: 'Example List', trust: 'community', locked: false, enabled: true, status: 'failed', pluginCount: 0, error: 'failed', reason }
}

function loadedSource(): SourceRow {
  return { url: 'https://lists.example.invalid/ok.json', label: 'example/ok', name: 'Loaded List', trust: 'community', locked: false, enabled: true, status: 'ok', pluginCount: 3, error: null, reason: null }
}

describe('an empty store names the thing that went wrong', () => {
  it('calls a spent request ration what it is rather than a sign-in problem', () => {
    expect(emptyStoreReason(false, [failedSource('ratelimited')])).toBe('ratelimited')
  })

  it('treats a private list and a missing one the same way, since a sign-in reaches both', () => {
    expect(emptyStoreReason(false, [failedSource('auth')])).toBe('auth')
    expect(emptyStoreReason(false, [failedSource('notfound')])).toBe('auth')
  })

  it('calls an unreachable GitHub offline', () => {
    expect(emptyStoreReason(false, [failedSource('network')])).toBe('offline')
  })

  it('names the actionable failure when sources fail for different reasons', () => {
    expect(emptyStoreReason(false, [failedSource('network'), failedSource('ratelimited')])).toBe('ratelimited')
  })

  it('blames the filters, not the sources, when there are plugins to show', () => {
    expect(emptyStoreReason(true, [failedSource('ratelimited')])).toBe('filtered')
  })

  it('calls a list that arrived with nothing in it empty, never offline', () => {
    expect(emptyStoreReason(false, [failedSource('empty')])).toBe('empty')
  })

  it('says nothing is available when every source loaded and brought no plugins', () => {
    expect(emptyStoreReason(false, [loadedSource()])).toBe('none')
  })
})

describe('the sign-in is offered only where it helps', () => {
  it('offers it for a spent ration and for a list that is not public', () => {
    expect(offersSignIn('ratelimited')).toBe(true)
    expect(offersSignIn('auth')).toBe(true)
  })

  it('never offers it to someone who cannot reach GitHub at all', () => {
    expect(offersSignIn('offline')).toBe(false)
    expect(offersSignIn('empty')).toBe(false)
    expect(offersSignIn('none')).toBe(false)
    expect(offersSignIn('filtered')).toBe(false)
  })

  it('offers it on a failed source row, never on one that loaded', () => {
    expect(signInWouldReach(failedSource('ratelimited'))).toBe(true)
    expect(signInWouldReach(failedSource('network'))).toBe(false)
    expect(signInWouldReach(loadedSource())).toBe(false)
  })
})
