import { describe, it, expect } from 'vitest'
import { uploadSpeed, formatUploadRate, uploadPercent } from './progress'

describe('uploadSpeed', () => {
  it('is bytes per second derived from elapsed milliseconds', () => {
    expect(uploadSpeed(2048, 1000)).toBe(2048)
  })

  it('is 0 before any time elapses (no divide-by-zero)', () => {
    expect(uploadSpeed(2048, 0)).toBe(0)
  })
})

describe('formatUploadRate', () => {
  it('shows MB/s at or above 1 MB/s', () => {
    expect(formatUploadRate(1.5 * 1024 * 1024)).toBe('1.5 MB/s')
  })

  it('shows KB/s below 1 MB/s', () => {
    expect(formatUploadRate(200 * 1024)).toBe('200 KB/s')
  })

  it('is empty with no measurable rate yet', () => {
    expect(formatUploadRate(0)).toBe('')
  })
})

describe('uploadPercent', () => {
  it('rounds the sent/total ratio and caps at 100', () => {
    expect(uploadPercent({ sent: 50, total: 200, bytesPerSecond: 0 })).toBe(25)
    expect(uploadPercent({ sent: 250, total: 200, bytesPerSecond: 0 })).toBe(100)
  })

  it('is 0 for an unknown total', () => {
    expect(uploadPercent({ sent: 10, total: 0, bytesPerSecond: 0 })).toBe(0)
  })
})
