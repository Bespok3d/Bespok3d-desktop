import { describe, it, expect } from 'vitest'
import { parseArpTable, normalizeMac } from './arp-parse'

describe('normalizeMac', () => {
  it('zero-pads the unpadded octets macOS prints', () => {
    expect(normalizeMac('a4:83:e7:1:2:3')).toBe('a4:83:e7:01:02:03')
  })

  it('lowercases and converts Windows dash form to colons', () => {
    expect(normalizeMac('A4-83-E7-01-02-03')).toBe('a4:83:e7:01:02:03')
  })
})

describe('parseArpTable', () => {
  it('reads the macOS "arp -an" layout', () => {
    const text = [
      '? (10.6.9.108) at a4:83:e7:1:2:3 on en0 ifscope [ethernet]',
      '? (10.6.9.110) at (incomplete) on en0 [ethernet]',
    ].join('\n')
    const table = parseArpTable(text)
    expect(table.get('10.6.9.108')).toBe('a4:83:e7:01:02:03')
    expect(table.has('10.6.9.110')).toBe(false)
  })

  it('reads the Linux /proc/net/arp layout', () => {
    const text = [
      'IP address       HW type     Flags       HW address            Mask     Device',
      '10.6.9.96        0x1         0x2         34:7e:5c:aa:bb:cc     *        eth0',
    ].join('\n')
    expect(parseArpTable(text).get('10.6.9.96')).toBe('34:7e:5c:aa:bb:cc')
  })

  it('reads the Windows "arp -a" layout', () => {
    const text = [
      'Interface: 10.6.9.5 --- 0x4',
      '  Internet Address      Physical Address      Type',
      '  10.6.9.197            2c-3a-e8-11-22-33     dynamic',
    ].join('\n')
    expect(parseArpTable(text).get('10.6.9.197')).toBe('2c:3a:e8:11:22:33')
  })
})
