// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export interface RepoRef {
  owner: string
  repo: string
}

export interface RepoInfo {
  owner: string
  repo: string
  url: string
  isNew: boolean
}

export interface FileContent {
  content: string
  sha: string
}

export interface PrOptions {
  title: string
  body: string
  head: string
  base: string
}

export interface PrInfo {
  number: number
  url: string
}

export interface ReleaseOptions {
  tag: string
  title: string
  body?: string
  draft?: boolean
}

export interface AssetInfo {
  id: string
  name: string
  downloadUrl: string
  downloadCount: number
}

// Real, fetched-on-demand stats for a single release asset (a plugin's download_url): the live
// download count and the asset's upload date (the actual publish date of that version).
export interface AssetStat {
  downloadCount: number | null
  publishedAt: string | null
}

export interface ReleaseInfo {
  id: string
  tag: string
  name: string
  body: string
  prerelease: boolean
  publishedAt: string | null
  url: string
  assets: AssetInfo[]
}

export interface ConnectionRequest {
  type: 'device-flow' | 'pat'
  userCode?: string
  verificationUrl?: string
  expiresAt: Date
}

export interface GitHostAccount {
  login: string
  name: string
}

export interface TokenInfo {
  type: 'device-flow' | 'pat'
  scopes: string[]
  expiresAt: Date | null
}

export interface GitHostConnector {
  getAccount(): Promise<GitHostAccount | null>
  getTokenInfo(): Promise<TokenInfo>
  beginConnect(pat?: string): Promise<ConnectionRequest>
  waitForAuthorization(request: ConnectionRequest): Promise<void>
  disconnect(): Promise<void>
  isConnected(): Promise<boolean>

  createRepo(name: string, description: string, isPrivate?: boolean, owner?: string): Promise<RepoInfo>
  listRepos(): Promise<RepoInfo[]>
  // Orgs the connected account can create repos in (the account login itself is offered separately).
  listOrgs(): Promise<string[]>

  // `ref` names a branch, tag or commit; omitted, the host answers with the repo's default branch.
  getFile(repo: RepoRef, path: string, ref?: string): Promise<FileContent | null>
  putFile(repo: RepoRef, path: string, content: string, message: string, sha?: string): Promise<void>
  deleteFile(repo: RepoRef, path: string, message: string, sha: string): Promise<void>

  openPullRequest(repo: RepoRef, opts: PrOptions): Promise<PrInfo>

  createRelease(repo: RepoRef, opts: ReleaseOptions): Promise<ReleaseInfo>
  uploadReleaseAsset(repo: RepoRef, releaseId: string, name: string, data: Buffer): Promise<AssetInfo>
  downloadReleaseAsset(url: string): Promise<Buffer>
  assetInfo(url: string): Promise<AssetStat>
  publishRelease(repo: RepoRef, releaseId: string): Promise<void>
  listReleases(repo: RepoRef): Promise<ReleaseInfo[]>
}
