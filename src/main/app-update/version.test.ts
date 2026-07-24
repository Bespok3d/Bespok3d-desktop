import { describe, it, expect } from 'vitest'
import { parseSemanticVersion, compareSemanticVersions, isReleaseNewer } from './version'

describe('parseSemanticVersion', () => {
  it('splits release triple and prerelease', () => {
    expect(parseSemanticVersion('0.1.0-alpha.13')).toEqual({
      release: [0, 1, 0],
      prereleaseLabel: 'alpha',
      prereleaseNumber: 13,
    })
  })

  it('tolerates a leading v and a missing prerelease', () => {
    expect(parseSemanticVersion('v1.2.3')).toEqual({
      release: [1, 2, 3],
      prereleaseLabel: null,
      prereleaseNumber: 0,
    })
  })
})

describe('compareSemanticVersions', () => {
  it('orders two alphas of the same release (the case utils/version.ts gets wrong)', () => {
    expect(compareSemanticVersions('0.1.0-alpha.13', '0.1.0-alpha.14')).toBe(-1)
    expect(compareSemanticVersions('0.1.0-alpha.14', '0.1.0-alpha.13')).toBe(1)
  })

  it('treats identical versions as equal', () => {
    expect(compareSemanticVersions('0.1.0-alpha.13', '0.1.0-alpha.13')).toBe(0)
  })

  it('sorts a stable release above a prerelease of the same triple', () => {
    expect(compareSemanticVersions('0.1.0-alpha.13', '0.1.0')).toBe(-1)
    expect(compareSemanticVersions('0.1.0', '0.1.0-alpha.13')).toBe(1)
  })

  it('compares the release triple before the prerelease', () => {
    expect(compareSemanticVersions('0.2.0', '0.1.0-alpha.99')).toBe(1)
    expect(compareSemanticVersions('0.1.0-alpha.1', '0.2.0-alpha.1')).toBe(-1)
  })
})

describe('isReleaseNewer', () => {
  it('is true only when the candidate tag is strictly newer', () => {
    expect(isReleaseNewer('0.1.0-alpha.13', 'v0.1.0-alpha.14')).toBe(true)
    expect(isReleaseNewer('0.1.0-alpha.13', '0.1.0-alpha.13')).toBe(false)
    expect(isReleaseNewer('0.1.0-alpha.13', 'v0.1.0-alpha.12')).toBe(false)
  })
})
