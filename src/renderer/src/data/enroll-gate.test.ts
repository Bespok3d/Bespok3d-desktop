import { describe, it, expect } from 'vitest'
import { daemonAccessDecision, enrollPathDecision } from './enroll-gate'

describe('daemonAccessDecision (a managed daemon we do not own)', () => {
  it('asks for access when a managed daemon is foreign (not enrolled, no access grant)', () => {
    expect(daemonAccessDecision({ isManaged: true, enrolled: false, hasAccessIdentity: false })).toBe('access')
  })

  it('takes the enroll path when the managed daemon is one we enrolled', () => {
    expect(daemonAccessDecision({ isManaged: true, enrolled: true, hasAccessIdentity: false })).toBe('enroll-path')
  })

  it('takes the enroll path when we already hold an access grant', () => {
    expect(daemonAccessDecision({ isManaged: true, enrolled: false, hasAccessIdentity: true })).toBe('enroll-path')
  })

  it('takes the enroll path when no daemon answers at all', () => {
    expect(daemonAccessDecision({ isManaged: false, enrolled: false, hasAccessIdentity: false })).toBe('enroll-path')
  })
})

describe('enrollPathDecision (SSH reachability gates enrollment)', () => {
  it('shows the root-access gate when SSH is closed', () => {
    expect(enrollPathDecision({ sshOpen: false, fromAdd: false })).toBe('root-gate')
    expect(enrollPathDecision({ sshOpen: false, fromAdd: true })).toBe('root-gate')
  })

  it('proposes enrollment for a just-added printer when SSH is open', () => {
    expect(enrollPathDecision({ sshOpen: true, fromAdd: true })).toBe('enroll-proposal')
  })

  it('starts enrollment straight away on an explicit Enroll with SSH open', () => {
    expect(enrollPathDecision({ sshOpen: true, fromAdd: false })).toBe('enroll')
  })
})
