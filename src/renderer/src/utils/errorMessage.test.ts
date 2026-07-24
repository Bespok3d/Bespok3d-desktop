import { describe, it, expect } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('returns the message of an Error without the "Error:" prefix', () => {
    expect(errorMessage(new Error('disk full'))).toBe('disk full')
  })

  it('passes a thrown string through unchanged', () => {
    expect(errorMessage('plain failure')).toBe('plain failure')
  })

  it('coerces a non-Error, non-string value', () => {
    expect(errorMessage(404)).toBe('404')
    expect(errorMessage(null)).toBe('null')
  })

  it('reads the message of an Error subclass', () => {
    class TimeoutError extends Error {}
    expect(errorMessage(new TimeoutError('timed out'))).toBe('timed out')
  })
})
