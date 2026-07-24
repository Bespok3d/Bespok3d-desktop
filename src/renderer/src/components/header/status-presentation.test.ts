import { describe, it, expect } from 'vitest'
import { statusReasonKey } from './status-presentation'
import type { Printer, ConnectionReach } from '../../data/types'

const BASE: Printer = {
  id: 'p1', nick: 'Test', model: 'test', adapter: 'snapmaker-u1',
  host: 'test.local', ip: '1.2.3.4', status: 'online', installedIds: [],
}

function withState(status: Printer['status'], reach?: ConnectionReach): Printer {
  if (!reach) return { ...BASE, status, connection: undefined }

  return { ...BASE, status, connection: { reach, sshOpen: reach === 'managed' || reach === 'recoverable' } }
}

describe('statusReasonKey (the full status x reach matrix)', () => {
  it('reports the daemon healthy when managed', () => {
    expect(statusReasonKey(withState('managed', 'managed'))).toBe('status.dot.managed')
  })

  it('prefers the specific reach when online but the daemon is down', () => {
    expect(statusReasonKey(withState('online', 'recoverable'))).toBe('status.reach.recoverable')
    expect(statusReasonKey(withState('online', 'alive-no-ssh'))).toBe('status.reach.alive-no-ssh')
  })

  it('falls back to the bare online status when reach is offline or unknown', () => {
    expect(statusReasonKey(withState('online', 'offline'))).toBe('status.dot.online')
    expect(statusReasonKey(withState('online'))).toBe('status.dot.online')
  })

  it('uses the bare status for offline, checking, and deactivated regardless of reach', () => {
    expect(statusReasonKey(withState('offline', 'offline'))).toBe('status.dot.offline')
    expect(statusReasonKey(withState('checking'))).toBe('status.dot.checking')
    expect(statusReasonKey(withState('deactivated'))).toBe('status.dot.deactivated')
  })

  it('never uses a reach reason unless the status is online (a stale reach cannot mislabel managed)', () => {
    expect(statusReasonKey(withState('managed', 'recoverable'))).toBe('status.dot.managed')
    expect(statusReasonKey(withState('offline', 'recoverable'))).toBe('status.dot.offline')
  })
})
