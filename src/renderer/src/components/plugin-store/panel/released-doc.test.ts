// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { installB3d } from '../../../test/b3d-mock'
import { useReleasedDoc } from './released-doc'

const ASSET = 'https://api.github.com/repos/Bespok3d/u1-hw-camera/releases/assets/42'

describe('useReleasedDoc', () => {
  it('shows the notes published with the offered version, not the copy compiled into the app', async () => {
    installB3d({ registry: { releaseDoc: () => Promise.resolve({ text: '## 0.1.10\nwhat this release changed', problem: null }) } })
    const { result } = renderHook(() => useReleasedDoc(ASSET, '## 0.1.9\nthe app build is this old'))
    await waitFor(() => expect(result.current).toContain('0.1.10'))
  })

  it('shows the bundled copy while the release notes are still being read', () => {
    installB3d({ registry: { releaseDoc: () => new Promise<never>(() => {}) } })
    const { result } = renderHook(() => useReleasedDoc(ASSET, '## 0.1.9\nthe app build is this old'))
    expect(result.current).toContain('0.1.9')
  })

  it('shows the bundled copy when the machine cannot reach the release', async () => {
    installB3d({ registry: { releaseDoc: () => Promise.reject(new Error('offline')) } })
    const { result } = renderHook(() => useReleasedDoc(ASSET, '## 0.1.9\nthe app build is this old'))
    await waitFor(() => expect(result.current).toContain('0.1.9'))
  })

  it('shows the bundled copy when the release notes came back empty', async () => {
    installB3d({ registry: { releaseDoc: () => Promise.resolve({ text: null, problem: 'empty' }) } })
    const { result } = renderHook(() => useReleasedDoc(ASSET, '## 0.1.9\nthe app build is this old'))
    await waitFor(() => expect(result.current).toContain('0.1.9'))
  })

  it('asks for nothing when the publisher released no notes with the version', () => {
    const releaseDoc = vi.fn(() => Promise.resolve({ text: 'unexpected', problem: null }))
    installB3d({ registry: { releaseDoc } })
    const { result } = renderHook(() => useReleasedDoc(undefined, '## 0.1.9\nthe bundled copy'))
    expect(releaseDoc).not.toHaveBeenCalled()
    expect(result.current).toContain('0.1.9')
  })

  it('leaves a page with neither a release nor a bundled copy empty rather than showing another plugin\'s', () => {
    installB3d()
    const { result } = renderHook(() => useReleasedDoc(undefined, undefined))
    expect(result.current).toBeUndefined()
  })
})
