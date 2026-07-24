import { describe, it, expect } from 'vitest'
// @ts-expect-error - build-time generator, plain JS with no type declarations
import { buildIndex } from '../../../../scripts/app-bundle.mjs'
import { buildLocalIndex } from './build-index'
import { CPU_TEMP_MANIFEST as FULL } from './manifest-fixture'

describe('buildLocalIndex', () => {
  it('produces the same plugin entries as the bundled buildIndex (no drift)', () => {
    const local = buildLocalIndex([FULL as never]) as { plugins: unknown[] }
    const bundled = buildIndex([FULL]) as { plugins: unknown[] }
    expect(local.plugins).toEqual(bundled.plugins)
  })

  it('falls back gracefully on a metadata-thin manifest', () => {
    const thin = { name: 'mini', version: '0.0.1', install: {} }
    const entry = (buildLocalIndex([thin as never]) as { plugins: Record<string, unknown>[] }).plugins[0]
    expect(entry.title).toBe('mini')
    expect(entry.download_url).toBe('mini-0.0.1.b3')
    expect(entry.category).toBe('other')
  })
})
