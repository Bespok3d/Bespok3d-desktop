// Read/dismissed/seen state for the notification center, kept separate from the derived notices so the
// builder stays pure. Notices are derived every render with stable ids; this layer records which ids
// the user has read or dismissed, and when each was first seen (for the relative-time label). Dismissed
// notices are hidden; the badge counts unread, non-dismissed notices. A plugin-update id carries its
// target version, so a new release reappears even after the previous one was dismissed; a live-condition
// notice (e.g. sources-need-auth) is re-armed each session so a still-broken state nags again.
import type { Notice } from './notices'

export interface NoticeState {
  read: string[]
  dismissed: string[]
  seen: Record<string, number>
}

export const EMPTY_NOTICE_STATE: NoticeState = { read: [], dismissed: [], seen: {} }

export function withId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id]
}

export function withIds(ids: string[], add: string[]): string[] {
  return [...new Set([...ids, ...add])]
}

export function withoutId(ids: string[], id: string): string[] {
  return ids.filter((entry) => entry !== id)
}

// Stamp the first-seen time for any currently-shown notice id, and drop ids no longer shown so the map
// stays bounded. `seen[id]` is stable once set (it records when the notice first appeared this session).
export function stampSeen(seen: Record<string, number>, ids: string[], now: number): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, seen[id] ?? now]))
}

export function sameSeen(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = Object.keys(left)

  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key])
}

export function visibleNotices(notices: Notice[], dismissed: string[]): Notice[] {
  const hidden = new Set(dismissed)

  return notices.filter((notice) => !hidden.has(notice.id))
}

export function unreadCount(notices: Notice[], state: NoticeState): number {
  const read = new Set(state.read)

  return visibleNotices(notices, state.dismissed).filter((notice) => !read.has(notice.id)).length
}

// Compact relative age: "just now", "5m ago", "3h ago", "2d ago", or an ISO date past a week.
export function relativeTime(thenMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - thenMs) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(thenMs).toISOString().slice(0, 10)
}
