import type { Printer } from '../types'

export function resolvedStatus(printer: Printer): Printer['status'] {
  if (printer.status === 'managed') return 'managed'

  return printer.installedIds.length > 0 ? 'managed' : 'online'
}

// The status-dot colour class, keyed off the coarse status (managed is the default green, so no
// modifier). Shared by the header dot and the Settings > Printers list, which both render the dot.
export function statusDotClass(printer: Printer): string {
  if (printer.status === 'managed') return ''
  if (printer.status === 'online') return 'online'
  if (printer.status === 'checking') return 'checking'

  return 'offline'
}

// Consecutive downgrades have to pile up before they take effect, so one slow or dropped probe (a
// transient blip, or a late tick after the app was backgrounded) never flips a healthy printer.
const OFFLINE_STRIKES = 2

export type ProbeStatus = 'managed' | 'online' | 'offline'

const STATUS_RANK: Record<ProbeStatus, number> = { offline: 0, online: 1, managed: 2 }

function statusRank(status: Printer['status']): number {
  return STATUS_RANK[status as ProbeStatus] ?? STATUS_RANK.offline
}

// Apply a probe outcome with downgrade hysteresis: a better-or-equal result takes effect immediately;
// a downgrade (managed -> online, online -> offline) only sticks after OFFLINE_STRIKES probes agree,
// so a single missed probe keeps the last-known better status.
export function statusAfterProbe(prev: Printer['status'], target: ProbeStatus, misses: number): { status: Printer['status']; misses: number } {
  if (STATUS_RANK[target] >= statusRank(prev)) return { status: target, misses: 0 }
  const next = misses + 1
  if (next >= OFFLINE_STRIKES) return { status: target, misses: 0 }

  return { status: prev, misses: next }
}
