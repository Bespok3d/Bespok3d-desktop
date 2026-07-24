import { ipcRenderer } from 'electron'
import type {
  GitHostAccount,
  TokenInfo,
  ConnectionRequest,
  RepoInfo,
  FileContent,
  PrOptions,
  PrInfo,
  ReleaseOptions,
  ReleaseInfo,
  AssetInfo,
} from '../main/git-host/connector'
import type { GitHostSettings } from '../main/git-host'

export const gitHostApi = {
  settings: (): Promise<GitHostSettings> => ipcRenderer.invoke('git-host:settings'),
  writeSettings: (settings: GitHostSettings): Promise<void> =>
    ipcRenderer.invoke('git-host:settings:write', settings),

  isConnected: (): Promise<boolean> => ipcRenderer.invoke('git-host:isConnected'),
  storageEncrypted: (): Promise<boolean> => ipcRenderer.invoke('git-host:storageEncrypted'),
  getAccount: (): Promise<GitHostAccount | null> => ipcRenderer.invoke('git-host:getAccount'),
  getTokenInfo: (): Promise<TokenInfo> => ipcRenderer.invoke('git-host:getTokenInfo'),
  beginConnect: (pat?: string): Promise<ConnectionRequest> =>
    ipcRenderer.invoke('git-host:beginConnect', pat),
  waitForAuth: (request: ConnectionRequest): Promise<void> =>
    ipcRenderer.invoke('git-host:waitForAuth', request),
  disconnect: (): Promise<void> => ipcRenderer.invoke('git-host:disconnect'),

  createRepo: (name: string, description: string, isPrivate?: boolean, owner?: string): Promise<RepoInfo> =>
    ipcRenderer.invoke('git-host:createRepo', name, description, isPrivate, owner),
  listOrgs: (): Promise<string[]> => ipcRenderer.invoke('git-host:listOrgs'),
  listRepos: (): Promise<RepoInfo[]> => ipcRenderer.invoke('git-host:listRepos'),

  getFile: (owner: string, repo: string, path: string): Promise<FileContent | null> =>
    ipcRenderer.invoke('git-host:getFile', owner, repo, path),
  putFile: (
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<void> => ipcRenderer.invoke('git-host:putFile', owner, repo, path, content, message, sha),
  deleteFile: (
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string
  ): Promise<void> => ipcRenderer.invoke('git-host:deleteFile', owner, repo, path, message, sha),

  openPr: (owner: string, repo: string, opts: PrOptions): Promise<PrInfo> =>
    ipcRenderer.invoke('git-host:openPr', owner, repo, opts),

  createRelease: (owner: string, repo: string, opts: ReleaseOptions): Promise<ReleaseInfo> =>
    ipcRenderer.invoke('git-host:createRelease', owner, repo, opts),
  uploadAsset: (
    owner: string,
    repo: string,
    releaseId: string,
    name: string,
    data: Uint8Array
  ): Promise<AssetInfo> =>
    ipcRenderer.invoke('git-host:uploadAsset', owner, repo, releaseId, name, Buffer.from(data)),
  publishRelease: (owner: string, repo: string, releaseId: string): Promise<void> =>
    ipcRenderer.invoke('git-host:publishRelease', owner, repo, releaseId),
  listReleases: (owner: string, repo: string): Promise<ReleaseInfo[]> =>
    ipcRenderer.invoke('git-host:listReleases', owner, repo),
}
