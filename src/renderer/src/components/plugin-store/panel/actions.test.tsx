// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { UsePluginOpsResult } from '../../../hooks/pluginOps'
import { usePanelActions } from './actions'

function panelActions(install: () => void, beforeInstall?: () => Promise<void>) {
  return renderHook(() => usePanelActions({
    ops: { install } as unknown as UsePluginOpsResult,
    printerId: 'printer-1',
    pluginId: 'demo',
    missingDeps: [],
    dependents: [],
    warnDaemonUnknown: false,
    beforeInstall,
  }))
}

afterEach(() => vi.restoreAllMocks())

describe('usePanelActions install', () => {
  it('hands the claimed port over before the install goes out', async () => {
    var order: string[] = []
    var install = vi.fn(() => { order.push('install') })
    var { result } = panelActions(install, async function handOver() { order.push('hand-over') })

    await act(async () => { result.current.requestInstall() })

    expect(order).toEqual(['hand-over', 'install'])
  })

  it('still installs when the printer refuses to move the other web UI off the port', async () => {
    var logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    var install = vi.fn()
    var { result } = panelActions(install, () => Promise.reject(new Error('printer refused')))

    await act(async () => { result.current.requestInstall() })

    expect(install).toHaveBeenCalledWith('printer-1', 'demo', undefined, [], undefined, undefined)
    expect(logged).toHaveBeenCalled()
  })
})
