// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { daemonDriverMismatch, writtenForMachines } from './daemonReason'

describe('daemonDriverMismatch', () => {
  it('recognises a daemon asking its driver for something the driver does not have', () => {
    expect(daemonDriverMismatch("ProtocolError: AttributeError: 'SnapmakerU1Jinni' object has no attribute 'service_control'")).toBe(true)
  })

  it('recognises a driver that does not know the word the daemon used', () => {
    expect(daemonDriverMismatch('unknown verb: service_control')).toBe(true)
  })

  it('leaves a refusal the printer meant alone, so re-enrolling is never offered for a running print', () => {
    expect(daemonDriverMismatch('The printer is busy: this would restart klipper and moonraker, interrupting the print.')).toBe(false)
  })

  it('leaves an unreachable printer alone, because setting it up again cannot reach it either', () => {
    expect(daemonDriverMismatch('connect ETIMEDOUT 192.0.2.51:7130')).toBe(false)
  })
})

describe('writtenForMachines', () => {
  it('recognises a transport status carrying the daemon body verbatim', () => {
    expect(writtenForMachines('daemon 422: {"detail":"ProtocolError: AttributeError: \'SnapmakerU1Jinni\' object has no attribute \'service_control\'"}')).toBe(true)
  })

  it('recognises a bare python exception chain', () => {
    expect(writtenForMachines("ProtocolError: AttributeError: 'SnapmakerU1Jinni' object has no attribute 'service_control'")).toBe(true)
  })

  it('recognises a socket failure', () => {
    expect(writtenForMachines('connect ETIMEDOUT 192.0.2.51:7130')).toBe(true)
  })

  it('leaves the busy-printer refusal on screen, because it is written for a person', () => {
    expect(writtenForMachines('The printer is busy: this would restart klipper and moonraker, interrupting the print.')).toBe(false)
  })
})
