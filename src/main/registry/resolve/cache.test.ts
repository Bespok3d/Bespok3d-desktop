// The cache key binds bytes to the url they were served from. These tests pin that binding: an entry
// filed under a key it does not claim was moved by something other than this module, and a moved entry
// is how the org-signed official index ends up rendering its badge over a list that never served it.
// Re-verification cannot catch it (the bytes really are signed), so the drop happens on load.
import { describe, it, expect, vi } from 'vitest'
import type { CacheEntry } from './cache'

const mocks = vi.hoisted(() => ({ diskEntries: [] as Array<[string, unknown]>, writeFileSync: vi.fn() }))

vi.mock('fs', () => ({ writeFileSync: mocks.writeFileSync }))
vi.mock('../../json-store', () => ({ readJsonFile: () => mocks.diskEntries }))
vi.mock('../../app-paths', () => ({ userDataPath: (name: string) => `/fixture-user-data/${name}` }))

const OFFICIAL_URL = 'https://lists.example.invalid/official.json'
const OTHER_URL = 'https://lists.example.invalid/community.json'
const SIGNATURE = '-----BEGIN PGP SIGNATURE-----\n\nOBVIOUSLY-FAKE-FIXTURE-SIGNATURE\n-----END PGP SIGNATURE-----\n'
const SIGNED_BYTES = '{"schema_version":1,"name":"Official List","plugins":[]}\n'

function storedEntry(key: string): CacheEntry {
  return { key, bytes: SIGNED_BYTES, signature: SIGNATURE, etag: 'W/"fixture-etag"', lastModified: null, fetchedAt: 0 }
}

// loadCache memoizes in a module-level store, so every case needs a fresh module instance.
async function importCache(diskEntries: Array<[string, unknown]>): Promise<typeof import('./cache')> {
  mocks.diskEntries = diskEntries
  vi.resetModules()

  return import('./cache')
}

describe('loadCache', () => {
  it('drops an entry filed under a key it does not claim', async () => {
    const { loadCache } = await importCache([[OTHER_URL, storedEntry(OFFICIAL_URL)]])
    expect(loadCache().has(OTHER_URL)).toBe(false)
  })

  it('drops a legacy entry that carries no key at all', async () => {
    const { loadCache } = await importCache([[OFFICIAL_URL, { bytes: SIGNED_BYTES, signature: SIGNATURE }]])
    expect(loadCache().has(OFFICIAL_URL)).toBe(false)
  })

  it('keeps an entry whose stored key matches the key it sits under', async () => {
    const { loadCache } = await importCache([[OFFICIAL_URL, storedEntry(OFFICIAL_URL)]])
    expect(loadCache().get(OFFICIAL_URL)?.bytes).toBe(SIGNED_BYTES)
  })
})

describe('writeCache', () => {
  it('stamps the key from the url it was written under, so no caller can mis-supply it', async () => {
    const { loadCache, writeCache } = await importCache([])
    writeCache(OFFICIAL_URL, { bytes: SIGNED_BYTES, signature: SIGNATURE, etag: null, lastModified: null, fetchedAt: 0 })
    expect(loadCache().get(OFFICIAL_URL)?.key).toBe(OFFICIAL_URL)
  })

  it('persists an entry that survives its own load filter', async () => {
    const { writeCache } = await importCache([])
    writeCache(OFFICIAL_URL, { bytes: SIGNED_BYTES, signature: SIGNATURE, etag: null, lastModified: null, fetchedAt: 0 })
    const [, serialized] = mocks.writeFileSync.mock.calls.at(-1) as [string, string]
    expect(JSON.parse(serialized)).toEqual([[OFFICIAL_URL, expect.objectContaining({ key: OFFICIAL_URL })]])
  })
})
