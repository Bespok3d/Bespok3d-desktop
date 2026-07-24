import { describe, it, expect } from 'vitest'
import en from '../../../i18n/locales/en.json'

const cloudHint: string = (en as Record<string, string>)['discovery.cloud_hint']

describe('discovery.cloud_hint copy', () => {
  it('exists so the discovery screens can render the hint', () => {
    expect(cloudHint).toBeTruthy()
  })

  it('stays manufacturer-neutral instead of naming a specific vendor', () => {
    expect(cloudHint.toLowerCase()).not.toContain('snapmaker')
  })

  it('explains the local-advertising cause so the user knows why', () => {
    expect(cloudHint).toContain('mDNS')
    expect(cloudHint.toLowerCase()).toContain('cloud')
  })

  it('contains no em-dash', () => {
    expect(cloudHint).not.toContain(String.fromCharCode(0x2014))
  })
})
