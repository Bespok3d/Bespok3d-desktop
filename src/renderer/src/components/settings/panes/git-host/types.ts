export type Repo = { owner: string; repo: string }
export type Account = GitHostAccount
export type Settings = GitHostSettings
export type ConnRequest = GitHostConnectionRequest
export type PaneState = 'loading' | 'disconnected' | 'connecting' | 'connected'
