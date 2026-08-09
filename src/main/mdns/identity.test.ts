// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { modelFromTxt, vendorFromTxt, UNKNOWN_MODEL, UNKNOWN_VENDOR } from './identity'

// Captured from a real Snapmaker U1 on FW 1.5.2, with the serial and account replaced.
const U1_TXT = {
  version: '1.5.2',
  machine_type: 'Snapmaker U1',
  device_name: 'unU1',
  sn: '00000000000000000000',
  link_mode: 'wan',
  userid: '00000',
  ip: '192.0.2.108',
  region: 'int',
}

describe('what a device calls itself in its TXT record', () => {
  it('reads the Snapmaker U1 model, the only name it advertises', () => {
    expect(modelFromTxt(U1_TXT)).toBe('Snapmaker U1')
  })

  it('reads the generic model key a print server uses', () => {
    expect(modelFromTxt({ model: 'Voron 2.4' })).toBe('Voron 2.4')
  })

  it('reads usb_MDL after the TXT keys were lower-cased, which the old lookup never matched', () => {
    expect(modelFromTxt({ usb_mdl: 'MK4' })).toBe('MK4')
  })

  it('prefers the printer-specific machine type over a generic product string', () => {
    expect(modelFromTxt({ product: 'Klipper host', machine_type: 'Snapmaker U1' })).toBe(
      'Snapmaker U1'
    )
  })

  it('ignores a key that is present but empty rather than reporting a blank model', () => {
    expect(modelFromTxt({ machine_type: '   ', model: 'Trident' })).toBe('Trident')
  })

  it('says the model is a plain network device when nothing names it', () => {
    expect(modelFromTxt({ sn: '123' })).toBe(UNKNOWN_MODEL)
    expect(modelFromTxt({})).toBe(UNKNOWN_MODEL)
  })

  it('reads the vendor from any of the keys a device may use', () => {
    expect(vendorFromTxt({ vendor: 'Snapmaker' })).toBe('Snapmaker')
    expect(vendorFromTxt({ usb_mfg: 'Prusa' })).toBe('Prusa')
    expect(vendorFromTxt(U1_TXT)).toBe(UNKNOWN_VENDOR)
  })
})
