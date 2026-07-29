// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { withId, withIds, withoutId, stampSeen, sameSeen, relativeTime, visibleNotices, unreadCount, EMPTY_NOTICE_STATE } from './notice-state'
import type { Notice } from './notices'

function notice(id: string): Notice {
  return { id, severity: 'info', titleKey: 't', bodyKey: 'b' }
}

describe('notice-state', () => {
  it('withId adds an id once, never duplicating', () => {
    expect(withId(['a'], 'b')).toEqual(['a', 'b'])
    expect(withId(['a'], 'a')).toEqual(['a'])
  })

  it('withIds unions and dedupes', () => {
    expect(withIds(['a'], ['a', 'b', 'b'])).toEqual(['a', 'b'])
  })

  it('visibleNotices hides dismissed ids', () => {
    const list = [notice('a'), notice('b')]
    expect(visibleNotices(list, ['a']).map((entry) => entry.id)).toEqual(['b'])
  })

  it('unreadCount counts visible, unread notices only', () => {
    const list = [notice('a'), notice('b'), notice('c')]
    expect(unreadCount(list, EMPTY_NOTICE_STATE)).toBe(3)
    expect(unreadCount(list, { read: ['a'], dismissed: ['b'], seen: {} })).toBe(1)
  })

  it('withoutId removes an id', () => {
    expect(withoutId(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('stampSeen records first-seen for new ids and prunes ids no longer shown', () => {
    const seen = stampSeen({ one: 100 }, ['one', 'two'], 500)
    expect(seen).toEqual({ one: 100, two: 500 })
    expect(stampSeen({ one: 100, gone: 9 }, ['one'], 500)).toEqual({ one: 100 })
  })

  it('sameSeen compares maps by keys and values', () => {
    expect(sameSeen({ one: 1 }, { one: 1 })).toBe(true)
    expect(sameSeen({ one: 1 }, { one: 2 })).toBe(false)
    expect(sameSeen({ one: 1 }, { one: 1, two: 2 })).toBe(false)
  })

  it('relativeTime formats by age', () => {
    const now = 1_000_000_000_000
    expect(relativeTime(now, now)).toBe('just now')
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago')
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h ago')
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d ago')
    expect(relativeTime(now - 30 * 86_400_000, now)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
