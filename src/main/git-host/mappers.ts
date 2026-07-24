import type { AssetInfo, ReleaseInfo, RepoInfo } from './connector'

// GitHub and Gitea return the same release/repo JSON shapes, so these mappers are shared by both
// connectors. The one genuine difference - which field holds an asset's download url (GitHub's API
// url vs Gitea's browser_download_url) - stays a per-connector `mapAsset` passed in here.
type JsonObject = Record<string, unknown>

export function mapRelease(raw: JsonObject, mapAsset: (raw: JsonObject) => AssetInfo): ReleaseInfo {
  const assets = Array.isArray(raw.assets) ? (raw.assets as JsonObject[]).map(mapAsset) : []

  return {
    id: String(raw.id),
    tag: String(raw.tag_name),
    name: String(raw.name ?? raw.tag_name ?? ''),
    body: String(raw.body ?? ''),
    prerelease: Boolean(raw.prerelease),
    publishedAt: raw.published_at ? String(raw.published_at) : null,
    url: String(raw.html_url),
    assets,
  }
}

export function mapRepo(raw: JsonObject, isNew: boolean): RepoInfo {
  const owner = (raw.owner as JsonObject | undefined)?.login ?? (raw.full_name ? String(raw.full_name).split('/')[0] : undefined)

  return { owner: String(owner), repo: String(raw.name), url: String(raw.html_url), isNew }
}
