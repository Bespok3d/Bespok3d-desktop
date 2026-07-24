import { describe, it, expect } from 'vitest'
import { configTruth } from './config-truth'

const LIVE = { SPOOLMAN_SERVER: 'http://live:8000' }
const APPLIED = { SPOOLMAN_SERVER: 'http://applied:8000' }
const APPLIED_AT = '2026-07-02T10:00:00.000Z'

describe('configTruth ladder', () => {
  it('tier 1: a live daemon read wins over the applied record', () => {
    expect(configTruth(LIVE, APPLIED, APPLIED_AT)).toEqual({ tier: 'live', values: LIVE })
  })

  it('tier 1: an empty live map is still live truth (installed, no vars persisted), not a fallthrough', () => {
    expect(configTruth({}, APPLIED, APPLIED_AT)).toEqual({ tier: 'live', values: {} })
  })

  it('tier 2: without a live read, what this computer sent shows with its timestamp', () => {
    expect(configTruth(null, APPLIED, APPLIED_AT)).toEqual({ tier: 'applied', values: APPLIED, appliedAt: APPLIED_AT })
  })

  it('tier 3: with nothing to vouch for, values are explicitly unknown, never a guess', () => {
    expect(configTruth(null, undefined, undefined)).toEqual({ tier: 'unknown', values: {} })
  })
})
