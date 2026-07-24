import { describe, it, expect } from 'vitest'
import { mapRelease, mapRepo } from './mappers'
import type { AssetInfo } from './connector'

type JsonObject = Record<string, unknown>

// A trivial asset mapper so the release mapping is exercised without coupling to either host's
// asset-url quirk (GitHub uses the API url, Gitea the browser_download_url - the one part that
// genuinely differs and stays per-connector).
function mapAssetStub(raw: JsonObject): AssetInfo {
  return { id: String(raw.id), name: String(raw.name), downloadUrl: 'stub', downloadCount: 0 }
}

describe('mapRelease (shared GitHub/Gitea release mapper)', () => {
  it('maps every release field and runs each asset through the supplied asset mapper', () => {
    const release = mapRelease({
      id: 7, tag_name: 'v1.2.0', name: 'Release 1.2.0', body: 'notes',
      prerelease: true, published_at: '2026-01-02T00:00:00Z', html_url: 'https://host/r/7',
      assets: [{ id: 11, name: 'plugin.b3' }],
    }, mapAssetStub)

    expect(release).toEqual({
      id: '7', tag: 'v1.2.0', name: 'Release 1.2.0', body: 'notes',
      prerelease: true, publishedAt: '2026-01-02T00:00:00Z', url: 'https://host/r/7',
      assets: [{ id: '11', name: 'plugin.b3', downloadUrl: 'stub', downloadCount: 0 }],
    })
  })

  it('falls back name to the tag and yields no assets when assets is absent', () => {
    const release = mapRelease({ id: 1, tag_name: 'v0.1.0', html_url: 'https://host/r/1' }, mapAssetStub)

    expect(release.name).toBe('v0.1.0')
    expect(release.body).toBe('')
    expect(release.publishedAt).toBeNull()
    expect(release.assets).toEqual([])
  })
})

describe('mapRepo (shared GitHub/Gitea repo mapper)', () => {
  it('takes the owner login from the nested owner object', () => {
    expect(mapRepo({ owner: { login: 'Bespok3d' }, name: 'main-index', html_url: 'https://host/Bespok3d/main-index' }, true))
      .toEqual({ owner: 'Bespok3d', repo: 'main-index', url: 'https://host/Bespok3d/main-index', isNew: true })
  })

  it('falls back to the full_name owner segment when no owner object is present', () => {
    expect(mapRepo({ full_name: 'octocat/plugin', name: 'plugin', html_url: 'https://host/octocat/plugin' }, false).owner)
      .toBe('octocat')
  })
})
