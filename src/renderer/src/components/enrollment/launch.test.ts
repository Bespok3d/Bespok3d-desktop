import { describe, it, expect } from 'vitest'
import { autoStartEligible, awaitingUpdateConfirm, isDaemonRestartMode } from './index'

describe('autoStartEligible', () => {
  it('never auto-starts a daemon update (it waits for the confirm step)', () => {
    expect(autoStartEligible('update-daemon', false)).toBe(false)
    expect(autoStartEligible('update-daemon', true)).toBe(false)
  })

  it('never auto-starts history (nothing to run)', () => {
    expect(autoStartEligible('history', false)).toBe(false)
  })

  it('auto-starts other ops only when the printer uses adapter-default credentials', () => {
    expect(autoStartEligible('repair', false)).toBe(true)
    expect(autoStartEligible('reactivate', false)).toBe(true)
    expect(autoStartEligible('repair', true)).toBe(false)
  })
})

describe('awaitingUpdateConfirm', () => {
  it('gates only the update-daemon mode before it has been confirmed', () => {
    expect(awaitingUpdateConfirm('update-daemon', 'credentials', false)).toBe(true)
  })

  it('clears once confirmed so the op can run', () => {
    expect(awaitingUpdateConfirm('update-daemon', 'credentials', true)).toBe(false)
  })

  it('does not gate once the op is already enrolling', () => {
    expect(awaitingUpdateConfirm('update-daemon', 'enrolling', false)).toBe(false)
  })

  it('does not gate any other mode', () => {
    expect(awaitingUpdateConfirm('repair', 'credentials', false)).toBe(false)
    expect(awaitingUpdateConfirm('enroll', 'credentials', false)).toBe(false)
  })
})

describe('isDaemonRestartMode', () => {
  it('still flags update-daemon as a daemon-restart mode', () => {
    expect(isDaemonRestartMode('update-daemon')).toBe(true)
  })
})
