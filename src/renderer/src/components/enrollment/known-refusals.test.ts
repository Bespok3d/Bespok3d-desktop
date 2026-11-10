// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import { refusalMessageKey } from './known-refusals'

const U1_PREFLIGHT = fileURLToPath(new URL('../../../../../../adapters/snapmaker-u1/client/enroll-steps/preflight.ts', import.meta.url))
const EXTENDED_FIRMWARE_THROW = /throw new Error\('([^']*Extended firmware[^']*)'\)/

function adapterExtendedFirmwareRefusal(): string {
  return readFileSync(U1_PREFLIGHT, 'utf-8').match(EXTENDED_FIRMWARE_THROW)?.[1] ?? ''
}

describe('the known refusals', () => {
  it.skipIf(!existsSync(U1_PREFLIGHT))('still recognise the words the U1 adapter refuses an Extended-firmware printer with', () => {
    var adapterRefusal = adapterExtendedFirmwareRefusal()

    expect(adapterRefusal).not.toBe('')
    expect(refusalMessageKey(adapterRefusal)).toBe('enroll.refusal.extended_firmware')
  })

  it('leave any other refusal in the step words', () => {
    expect(refusalMessageKey('Permission denied (publickey,password).')).toBeNull()
  })
})
