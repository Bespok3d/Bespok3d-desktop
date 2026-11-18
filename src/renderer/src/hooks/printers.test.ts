// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { usePrinterSync } from './printers'
import { addRebootNotice, rebootNotices, removeRebootNotice } from '../data/active-watch/reboot-notices'
import { installB3d } from '../test/b3d-mock'

const REBOOT_TIME = Date.parse('2026-11-17T10:00:00Z')

afterEach(() => rebootNotices().forEach((notice) => removeRebootNotice(notice.printerId, notice.noticeId)))

describe('removing a printer', () => {
  it('takes away the reboot notices of that printer and keeps the others', () => {
    installB3d()
    addRebootNotice({ printerId: 'p1', printerName: 'Junior', noticeId: 'notice-1', rebootedAt: REBOOT_TIME })
    addRebootNotice({ printerId: 'p2', printerName: 'Senior', noticeId: 'notice-1', rebootedAt: REBOOT_TIME })
    const { result, unmount } = renderHook(() => usePrinterSync())
    act(() => result.current.handleRemovePrinter('p1'))
    expect(rebootNotices().map((notice) => notice.printerId)).toEqual(['p2'])
    unmount()
  })
})
