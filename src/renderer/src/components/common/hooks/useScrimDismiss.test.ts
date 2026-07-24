import { describe, it, expect } from 'vitest'
import { shouldDismissScrim } from './useScrimDismiss'

describe('shouldDismissScrim', () => {
  it('dismisses when the press both starts and ends on the backdrop', () => {
    expect(shouldDismissScrim(true, true)).toBe(true)
  })

  it('keeps the modal open when the press started inside it (drag out then release on backdrop)', () => {
    expect(shouldDismissScrim(false, true)).toBe(false)
  })

  it('keeps the modal open when the release landed inside it', () => {
    expect(shouldDismissScrim(true, false)).toBe(false)
  })
})
