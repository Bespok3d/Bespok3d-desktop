// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { makePlugin } from '../../test/fixtures'
import { usePluginPanel } from './state'

const notified = makePlugin({ id: 'demo' })
const other = makePlugin({ id: 'other' })
const catalog = [notified, other]
const versionsView = { tab: 'versions', variantKey: 'github:Bespok3d/main-index/index.json?ref=dev::testing' }

function panelOpenedByNotice() {
  return renderHook(() => usePluginPanel({ pluginId: notified.id, view: versionsView }, catalog, undefined))
}

describe('usePluginPanel', () => {
  it('opens the plugin a notice names on the view it asks for', () => {
    const { result } = panelOpenedByNotice()

    expect(result.current.panelPlugin?.id).toBe('demo')
    expect(result.current.tabRequest).toMatchObject({ id: 'demo', ...versionsView })
  })

  it('drops the notice view when another plugin is opened', () => {
    const { result } = panelOpenedByNotice()
    act(() => result.current.selectPanelPlugin(other))

    expect(result.current.panelPlugin?.id).toBe('other')
    expect(result.current.tabRequest).toBeNull()
  })

  it('keeps the notice view while the same plugin stays open', () => {
    const { result } = panelOpenedByNotice()
    act(() => result.current.selectPanelPlugin(notified))

    expect(result.current.tabRequest).toMatchObject({ id: 'demo', ...versionsView })
  })

  it('drops the notice view when the panel is closed, so the next open starts fresh', () => {
    const { result } = panelOpenedByNotice()
    act(() => result.current.selectPanelPlugin(null))
    act(() => result.current.selectPanelPlugin(notified))

    expect(result.current.tabRequest).toBeNull()
  })
})
