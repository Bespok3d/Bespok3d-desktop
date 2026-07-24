import { describe, it, expect } from 'vitest'
import { parseManifest, metadataComplete, B3ValidationError } from './b3-manifest'

const COMPLETE_METADATA = {
  name: 'cpu-temp',
  version: '0.1.2',
  install: {},
  title: 'CPU Temperature',
  description: 'desc',
  tagline: 'tag',
  category: 'sensors',
  channel: 'stable',
}

describe('parseManifest (lenient validation)', () => {
  it('accepts a minimal installable manifest', () => {
    expect(parseManifest('{"name":"mini","version":"0.0.1","install":{}}').name).toBe('mini')
  })

  it.each([
    ['not json', 'not valid JSON'],
    ['{"version":"1","install":{}}', 'no valid plugin name'],
    ['{"name":"Bad Name","version":"1","install":{}}', 'no valid plugin name'],
    ['{"name":"ok","install":{}}', 'no valid version'],
    ['{"name":"ok","version":"1"}', 'no install block'],
  ])('rejects %s', (text, fragment) => {
    expect(() => parseManifest(text)).toThrow(B3ValidationError)
    expect(() => parseManifest(text)).toThrow(new RegExp(fragment))
  })
})

describe('metadataComplete', () => {
  it('is true for a full manifest, false when a catalog field is missing', () => {
    expect(metadataComplete(COMPLETE_METADATA as never)).toBe(true)
    expect(metadataComplete({ ...COMPLETE_METADATA, tagline: undefined } as never)).toBe(false)
  })
})
