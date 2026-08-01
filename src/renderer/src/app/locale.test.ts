// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAppI18n } from './locale'
import { installB3d } from '../test/b3d-mock'
import { detectSystemLocale } from '../i18n'

describe('useAppI18n', () => {
  it('a fresh install follows the machine language: the preference is "system" and the text comes out in the OS locale', () => {
    installB3d()
    const { result } = renderHook(() => useAppI18n())

    expect(result.current.localePref).toBe('system')
    expect(result.current.i18n.locale).toBe(detectSystemLocale())
  })

  it('a language the user picked earlier wins over the machine one', async () => {
    installB3d({ settings: { get: vi.fn().mockResolvedValue({ uiLocale: 'ja' }) } })
    const { result } = renderHook(() => useAppI18n())

    await waitFor(() => expect(result.current.i18n.locale).toBe('ja'))
    expect(result.current.localePref).toBe('ja')
  })

  it('going back to the machine language stores the "system" sentinel, not the code it resolves to', () => {
    const { b3d } = installB3d()
    const { result } = renderHook(() => useAppI18n())

    act(() => { result.current.setLocalePref('system') })

    expect(b3d.settings.set).toHaveBeenCalledWith({ uiLocale: 'system' })
  })
})
