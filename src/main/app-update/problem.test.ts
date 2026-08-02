// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { updateProblemFromError } from './problem'

// electron-updater reports its own failures as free text, so the only way to tell the user which of
// the three things went wrong is to read that text. Anything unrecognised is the neutral one.
describe('updateProblemFromError', () => {
  it('reads a 404 from the updater as nothing published', () => {
    expect(updateProblemFromError(new Error('HttpError: 404 Not Found'))).toBe('notPublished')
  })

  it('reads a dns or socket failure as unreachable', () => {
    expect(updateProblemFromError(new Error('getaddrinfo ENOTFOUND github.com'))).toBe('unreachable')
    expect(updateProblemFromError(new Error('connect ECONNREFUSED 140.82.121.3:443'))).toBe('unreachable')
    expect(updateProblemFromError(new Error('The operation timed out'))).toBe('unreachable')
  })

  it('reads anything it does not recognise as unavailable', () => {
    expect(updateProblemFromError(new Error('cannot parse latest-mac.yml'))).toBe('unavailable')
  })

  it('reads a thrown non-error without blowing up', () => {
    expect(updateProblemFromError('404')).toBe('notPublished')
    expect(updateProblemFromError(null)).toBe('unavailable')
  })
})
