// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never { throw new Error('kaboom') }

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders the fallback instead of white-screening when a child throws in render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setup(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('renders its children unchanged when nothing throws', () => {
    setup(<ErrorBoundary><div>healthy content</div></ErrorBoundary>)
    expect(screen.getByText('healthy content')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('tells usage reporting what broke, once, and never what the message said', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reportRenderFailure = vi.fn().mockResolvedValue(undefined)

    setup(<ErrorBoundary><Boom /></ErrorBoundary>, { b3d: { analytics: { reportRenderFailure } } })

    expect(reportRenderFailure.mock.calls).toEqual([['Error']])
  })

  it('logs the caught error via componentDidCatch for bug reports', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setup(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(errorSpy.mock.calls.some((callArgs) =>
      callArgs[0] === 'ErrorBoundary caught a render error' && callArgs[1] instanceof Error && callArgs[1].message === 'kaboom'
    )).toBe(true)
  })
})
