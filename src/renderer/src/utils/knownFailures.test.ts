// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import { failureInUserWords, knownFailureKey } from './knownFailures'
import { ENROLLMENT_ALREADY_RUNNING, RESET_ACCESS_ALREADY_RUNNING } from '../../../main/ops/reset-access-busy'

const U1_PREFLIGHT = fileURLToPath(new URL('../../../../../adapters/snapmaker-u1/client/enroll-steps/preflight.ts', import.meta.url))
const EXTENDED_FIRMWARE_THROW = /throw new Error\('([^']*Extended firmware[^']*)'\)/

function adapterExtendedFirmwareRefusal(): string {
  return readFileSync(U1_PREFLIGHT, 'utf-8').match(EXTENDED_FIRMWARE_THROW)?.[1] ?? ''
}

function bracketedKey(messageKey: string): string {
  return `[${messageKey}]`
}

describe('the known failures', () => {
  it.skipIf(!existsSync(U1_PREFLIGHT))('still recognise the words the U1 adapter refuses an Extended-firmware printer with', () => {
    var adapterRefusal = adapterExtendedFirmwareRefusal()

    expect(adapterRefusal).not.toBe('')
    expect(knownFailureKey(adapterRefusal)).toBe('enroll.refusal.extended_firmware')
  })

  // Desktop issue 40: a repair whose SSH login the printer refused.
  it('answer a refused SSH login in user words', () => {
    expect(knownFailureKey('Error: All configured authentication methods failed')).toBe('failure.ssh_login_refused')
  })

  // Desktop issue 55: an uninstall whose SSH login never finished.
  it('answer an SSH login that never finished in user words', () => {
    expect(knownFailureKey('Error: Timed out while waiting for handshake')).toBe('failure.ssh_no_handshake')
  })

  // main-index issue 13: a store uninstall whose call to the printer's daemon got no answer.
  it('answer a printer that did not answer the connection in user words', () => {
    var storeUninstallFailure = "Error invoking remote method 'store:uninstall': Error: connect ETIMEDOUT 192.0.2.23:4269"

    expect(knownFailureKey(storeUninstallFailure)).toBe('failure.printer_no_answer')
  })

  it('blame the stopped Bespok3d service when the printer refuses its port', () => {
    var refusedOnDaemonPort = "Error invoking remote method 'store:install': Error: connect ECONNREFUSED 192.0.2.23:4269"

    expect(knownFailureKey(refusedOnDaemonPort)).toBe('failure.bespok3d_not_running')
  })

  it('blame the SSH service when the printer refuses the SSH port', () => {
    var refusedOnSshPort = "Error invoking remote method 'printer:reset-access': Error: connect ECONNREFUSED 192.0.2.23:22"

    expect(knownFailureKey(refusedOnSshPort)).toBe('failure.ssh_refused')
    expect(knownFailureKey('Error: connect ECONNREFUSED 192.0.2.23:2222')).toBeNull()
  })
})

describe('the known failures of a login on its own port', () => {
  it('blame the SSH service on the port its owner chose, and only that port', () => {
    var refusedOnCustomSshPort = "Error invoking remote method 'printer:reset-access': Error: connect ECONNREFUSED 192.0.2.23:2222"

    expect(knownFailureKey(refusedOnCustomSshPort, 2222)).toBe('failure.ssh_refused')
    expect(knownFailureKey('Error: connect ECONNREFUSED 192.0.2.23:22', 2222)).toBeNull()
    expect(failureInUserWords(refusedOnCustomSshPort, bracketedKey, 2222)).toBe('[failure.ssh_refused]')
  })

  it('still blame the stopped Bespok3d service when the SSH login uses another port', () => {
    expect(knownFailureKey('Error: connect ECONNREFUSED 192.0.2.23:4269', 2222)).toBe('failure.bespok3d_not_running')
  })

  it('blame the SSH service when its owner moved the SSH login onto the daemon port', () => {
    expect(knownFailureKey('Error: connect ECONNREFUSED 192.0.2.23:4269', 4269)).toBe('failure.ssh_refused')
  })

  it('read the port from the end of an IPv6 address, never from a group inside it', () => {
    expect(knownFailureKey('Error: connect ECONNREFUSED 2001:db8:22::5:4269')).toBe('failure.bespok3d_not_running')
  })
})

describe('the known failures of the network', () => {
  it('answer a printer the network cannot reach in user words', () => {
    expect(knownFailureKey('Error: connect EHOSTUNREACH 192.0.2.23:4269')).toBe('failure.printer_unreachable')
    expect(knownFailureKey('Error: connect ENETUNREACH 192.0.2.23:22 - Local (0.0.0.0:0)')).toBe('failure.no_network_to_printer')
  })

  it('answer a printer address that names nothing in user words', () => {
    expect(knownFailureKey('Error: getaddrinfo ENOTFOUND u1.local')).toBe('failure.printer_address_not_found')
  })
})

describe('the other known failures', () => {
  it('answer a second reset of access in user words', () => {
    var secondReset = `Error invoking remote method 'printer:reset-access': Error: ${RESET_ACCESS_ALREADY_RUNNING}`

    expect(knownFailureKey(secondReset)).toBe('failure.reset_access_already_running')
  })

  it('answer a reset of access refused during an enrollment in user words', () => {
    var resetDuringEnrollment = `Error invoking remote method 'printer:reset-access': Error: ${ENROLLMENT_ALREADY_RUNNING}`

    expect(knownFailureKey(resetDuringEnrollment)).toBe('failure.enrollment_already_running')
  })

  it('leave any other failure in its raw words', () => {
    expect(knownFailureKey('Permission denied (publickey,password).')).toBeNull()
    expect(failureInUserWords('Permission denied (publickey,password).', bracketedKey)).toBe('Permission denied (publickey,password).')
  })

  it('give the translated sentence for a known failure', () => {
    expect(failureInUserWords('Error: Timed out while waiting for handshake', bracketedKey)).toBe('[failure.ssh_no_handshake]')
  })
})
