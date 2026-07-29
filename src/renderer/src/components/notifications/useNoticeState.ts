// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { EMPTY_NOTICE_STATE, withId, withIds, withoutId, stampSeen, sameSeen } from './notice-state'
import type { NoticeState } from './notice-state'

const STORAGE_KEY = 'b3d.noticeState'

function loadState(): NoticeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    return raw ? { ...EMPTY_NOTICE_STATE, ...JSON.parse(raw) } : EMPTY_NOTICE_STATE
  } catch {
    return EMPTY_NOTICE_STATE
  }
}

export interface NoticeStateApi {
  state: NoticeState
  markRead: (id: string) => void
  dismiss: (id: string) => void
  markAllRead: (ids: string[]) => void
  dismissAll: (ids: string[]) => void
  markSeen: (ids: string[]) => void
  rearm: (id: string) => void
}

export function useNoticeState(): NoticeStateApi {
  const [state, setState] = useState<NoticeState>(loadState)

  function persist(next: NoticeState): void {
    setState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage may be unavailable (private mode, quota); read/dismiss is best-effort.
    }
  }

  function markSeen(ids: string[]): void {
    const seen = stampSeen(state.seen, ids, Date.now())
    if (sameSeen(seen, state.seen)) return
    persist({ ...state, seen })
  }

  // Re-arm a live-condition notice: forget its read/dismissed/seen so a still-active condition shows
  // fresh and unread again (used once per session for sources-need-auth).
  function rearm(id: string): void {
    const seen = Object.fromEntries(Object.entries(state.seen).filter(([key]) => key !== id))
    persist({ read: withoutId(state.read, id), dismissed: withoutId(state.dismissed, id), seen })
  }

  return {
    state,
    markRead: (id) => persist({ ...state, read: withId(state.read, id) }),
    dismiss: (id) => persist({ ...state, dismissed: withId(state.dismissed, id) }),
    markAllRead: (ids) => persist({ ...state, read: withIds(state.read, ids) }),
    dismissAll: (ids) => persist({ ...state, dismissed: withIds(state.dismissed, ids) }),
    markSeen,
    rearm,
  }
}
