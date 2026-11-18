// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { pingAndUpdate } from '../printers/probe'
import { installB3d } from '../../test/b3d-mock'
import type { B3dOverrides } from '../../test/b3d-mock'
import { makePrinter } from '../../test/fixtures'
import type { Printer } from '../types'

const STUCK_FRAME = { printerId: 'p1', token: 'screen-stuck', remedy: 'notify' as const }
const REBOOT_FRAME = { printerId: 'p1', token: 'screen-stuck', remedy: 'reboot' as const, noticeId: 'notice-1' }
const FRAME_TIME = Date.parse('2026-11-17T11:00:00Z')

// The notice store remembers the removed printers, so each test gets a store of its own.
const fresh = {} as typeof import('./reboot-notices') & typeof import('./useActiveWatch')

beforeEach(async () => {
  vi.resetModules()
  Object.assign(fresh, await import('./reboot-notices'), await import('./useActiveWatch'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function watchedPrinter(overrides: Partial<Printer> = {}): Printer {
  return makePrinter({ id: 'p1', nick: 'Junior', status: 'managed', daemonVersion: '0.15.0', ...overrides })
}

function renderWatch(printer: Printer, overrides: B3dOverrides = {}) {
  const harness = installB3d(overrides)
  const list = { current: [printer] }
  function setPrinters(update: (prev: Printer[]) => Printer[]): void {
    list.current = update(list.current)
  }
  renderHook(() => fresh.useActiveWatch(list.current, setPrinters))

  return { harness, list }
}

describe('the active-watch feed', () => {
  it('puts a reported fault on the reboot list once, however many frames say it', () => {
    const { harness, list } = renderWatch(watchedPrinter())
    act(() => {
      harness.emit.activeWatch(STUCK_FRAME)
      harness.emit.activeWatch(STUCK_FRAME)
    })
    expect(list.current[0].rebootRequired).toEqual(['screen-stuck'])
  })

  it('shows a notice when the printer rebooted itself', () => {
    vi.useFakeTimers({ now: FRAME_TIME, toFake: ['Date'] })
    const { harness } = renderWatch(watchedPrinter())
    act(() => harness.emit.activeWatch(REBOOT_FRAME))
    expect(fresh.rebootNotices()).toEqual([{ printerId: 'p1', printerName: 'Junior', noticeId: 'notice-1', rebootedAt: FRAME_TIME }])
  })

  it('opens no feed for a daemon older than the watch', () => {
    const watchActiveWatch = vi.fn()
    const { harness, list } = renderWatch(watchedPrinter({ daemonVersion: '0.14.0' }), { printers: { watchActiveWatch } })
    act(() => harness.emit.activeWatch(STUCK_FRAME))
    expect(watchActiveWatch).not.toHaveBeenCalled()
    expect(list.current[0].rebootRequired).toBeUndefined()
  })
})

describe('one answer to a fault: a restart notice or a power-cycle request', () => {
  it('does not ask for a power cycle while the printer restarts itself', () => {
    const { harness, list } = renderWatch(watchedPrinter())
    act(() => harness.emit.activeWatch(REBOOT_FRAME))
    expect(list.current[0].rebootRequired).toBeUndefined()
  })

  it('takes an earlier power-cycle request away once the printer restarts itself', () => {
    const { harness, list } = renderWatch(watchedPrinter({ rebootRequired: ['screen-stuck', 'other-state'] }))
    act(() => harness.emit.activeWatch(REBOOT_FRAME))
    expect(list.current[0].rebootRequired).toEqual(['other-state'])
  })

  it('drops the notice and asks for a power cycle when the printer takes a reboot back', () => {
    const { harness, list } = renderWatch(watchedPrinter())
    act(() => {
      harness.emit.activeWatch(REBOOT_FRAME)
      harness.emit.activeWatch({ ...STUCK_FRAME, noticeId: 'notice-1' })
    })
    expect(fresh.rebootNotices()).toEqual([])
    expect(list.current[0].rebootRequired).toEqual(['screen-stuck'])
  })
})

describe('a change in the watched printers', () => {
  it('keeps the feed of a printer still watched open, so no frame is lost', async () => {
    const feedCalls: string[] = []
    const watchActiveWatch = vi.fn(async (printerId: string) => { feedCalls.push(`watch ${printerId}`) })
    const unwatchActiveWatch = vi.fn(async (printerId: string) => { feedCalls.push(`unwatch ${printerId}`) })
    installB3d({ printers: { watchActiveWatch, unwatchActiveWatch } })
    const junior = watchedPrinter()
    const senior = watchedPrinter({ id: 'p2', nick: 'Senior' })
    const { rerender } = renderHook(({ printers }) => fresh.useActiveWatch(printers, vi.fn()), { initialProps: { printers: [junior] } })
    rerender({ printers: [junior, senior] })
    await act(async () => { await Promise.resolve() })
    expect(feedCalls).toEqual(['watch p1', 'watch p1', 'watch p2', 'unwatch p1'])
  })
})

describe('a printer removed while its watch still runs', () => {
  it('shows nothing from a frame heard before the watch stops', () => {
    const { harness } = renderWatch(watchedPrinter())
    act(() => fresh.removeRebootNoticesOf('p1'))
    act(() => harness.emit.activeWatch(REBOOT_FRAME))
    expect(fresh.rebootNotices()).toEqual([])
  })

  it('shows its reboots again once it is added back', () => {
    fresh.removeRebootNoticesOf('p1')
    const { harness } = renderWatch(watchedPrinter())
    act(() => harness.emit.activeWatch(REBOOT_FRAME))
    expect(fresh.rebootNotices()).toHaveLength(1)
  })
})

describe('the health check after a reported fault', () => {
  async function rebootListAfterPing(reported: string[]): Promise<string[] | undefined> {
    var seen: Printer[] = [watchedPrinter({ rebootRequired: ['screen-stuck'] })]
    vi.stubGlobal('b3d', { printers: { checkDaemon: vi.fn().mockResolvedValue({ isManaged: true, reach: 'managed', sshOpen: true, rebootRequired: reported }), checkWriteLayer: vi.fn() } })
    await pingAndUpdate(seen[0], (update) => { seen = update(seen) })

    return seen[0].rebootRequired
  }

  it('keeps the fault while the printer still reports it', async () => {
    expect(await rebootListAfterPing(['screen-stuck'])).toEqual(['screen-stuck'])
  })

  it('clears the fault once the printer no longer reports it', async () => {
    expect(await rebootListAfterPing([])).toEqual([])
  })
})
