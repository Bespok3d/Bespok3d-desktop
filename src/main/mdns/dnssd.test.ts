// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { parseDnsSdTxt } from './dnssd'
import { modelFromTxt } from './identity'

// A real `dns-sd -L` TXT line for a Snapmaker U1, serial and account replaced.
const U1_LINE =
  ' version=1.5.2 machine_type=Snapmaker\\ U1 device_name=unU1 sn=00000000000000000000 ip=192.0.2.108'

describe('the macOS scanner reads the same TXT record as the cross-platform one', () => {
  it('keeps a value that contains a space together', () => {
    expect(parseDnsSdTxt(U1_LINE)['machine_type']).toBe('Snapmaker U1')
  })

  it('names the printer through the shared key list', () => {
    expect(modelFromTxt(parseDnsSdTxt(U1_LINE))).toBe('Snapmaker U1')
  })

  it('lower-cases the keys so both scanners look a value up the same way', () => {
    expect(parseDnsSdTxt(' USB_MDL=MK4')['usb_mdl']).toBe('MK4')
  })

  it('keeps an equals sign that is part of the value', () => {
    expect(parseDnsSdTxt(' token=abc=def')['token']).toBe('abc=def')
  })
})
