// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
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

  it('requests access for a present daemon when this profile has no credentials', () => {
    expect(daemonAccessDecision({ accessState: 'present-awaiting-access', isManaged: false, enrolled: false, hasAccessIdentity: false })).toBe('access')
  })

  it('offers approval again for a rejected saved token even when an identity remains', () => {
    expect(daemonAccessDecision({ accessState: 'credentials-rejected', isManaged: false, enrolled: true, hasAccessIdentity: true })).toBe('access')
  })

  it('blocks changed or missing certificates behind an explicit warning path', () => {
    expect(daemonAccessDecision({ accessState: 'identity-changed', isManaged: false, enrolled: true, hasAccessIdentity: true })).toBe('identity-warning')
    expect(daemonAccessDecision({ accessState: 'certificate-missing', isManaged: false, enrolled: true, hasAccessIdentity: true })).toBe('identity-warning')
  })

  it('blocks unknown and offline probes from the SSH enrollment path', () => {
    expect(daemonAccessDecision({ accessState: 'unrecognized', isManaged: false, enrolled: false, hasAccessIdentity: false })).toBe('blocked')
    expect(daemonAccessDecision({ accessState: 'offline', isManaged: false, enrolled: false, hasAccessIdentity: false })).toBe('blocked')
  })

  it('keeps confirmed daemon absence eligible for explicit enrollment', () => {
    expect(daemonAccessDecision({ accessState: 'daemon-absent', isManaged: false, enrolled: false, hasAccessIdentity: false })).toBe('enroll-path')
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
