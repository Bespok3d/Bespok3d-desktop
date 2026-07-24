import { useState, useEffect } from 'react'
import { useCatalog } from '../../../../data/catalog'
import { errorMessage } from '../../../../utils/errorMessage'
import type { Repo, Account, Settings, ConnRequest, PaneState } from './types'

interface ConnectionSetters {
  setPaneState: (state: PaneState) => void
  setAccount: (account: Account | null) => void
  setSettings: (settings: Settings | null) => void
  setConnectionRequest: (request: ConnRequest | null) => void
  setTokenInfo: (token: TokenInfo | null) => void
  setStorageEncrypted: (encrypted: boolean) => void
  setError: (message: string | null) => void
}

async function verifiedRepos(settings: Settings): Promise<Settings> {
  const all = await window.b3d.gitHost.listRepos()
  function present(saved: Repo[] | undefined): Repo[] {
    return (saved ?? []).filter((repo) => all.some((real) => real.owner === repo.owner && real.repo === repo.repo))
  }

  return { ...settings, pluginRepos: present(settings.pluginRepos), listRepos: present(settings.listRepos) }
}

// Always show verified repos: filter the persisted plugin/list repos against the account's real
// repos so a stale or deleted entry never renders as if it exists.
async function loadVerifiedSettings(setters: ConnectionSetters) {
  const loaded = await window.b3d.gitHost.settings()
  try {
    setters.setSettings(await verifiedRepos(loaded))
  } catch {
    setters.setSettings({ ...loaded, pluginRepos: [], listRepos: [] })
  }
}

// Best-effort secondary probes: on failure each setter keeps its safe default (tokenInfo null,
// storageEncrypted true), and the pane's connection state is set by the surrounding flow; so a failure
// is non-fatal, but we log it rather than swallow it because a broken probe is worth seeing.
function pullTokenAndStorage(setters: ConnectionSetters) {
  window.b3d.gitHost.getTokenInfo().then(setters.setTokenInfo).catch((error) => console.warn('[git-host] token-info probe failed', error))
  window.b3d.gitHost.storageEncrypted().then(setters.setStorageEncrypted).catch((error) => console.warn('[git-host] storage-encryption probe failed', error))
}

async function loadInitialConnection(setters: ConnectionSetters) {
  const account = await window.b3d.gitHost.getAccount()
  if (!account) {
    setters.setSettings(await window.b3d.gitHost.settings())
    setters.setPaneState('disconnected')

    return
  }
  setters.setAccount(account)
  pullTokenAndStorage(setters)
  await loadVerifiedSettings(setters)
  setters.setPaneState('connected')
}

async function runConnect(setters: ConnectionSetters, pat: string | undefined, refreshCatalog: () => void, onSettingsUpdated: () => void) {
  setters.setError(null)
  setters.setPaneState('connecting')
  try {
    const request = await window.b3d.gitHost.beginConnect(pat)
    setters.setConnectionRequest(request)
    if (request.verificationUrl) window.b3d.openUrl(request.verificationUrl)
    await window.b3d.gitHost.waitForAuth(request)
    setters.setAccount(await window.b3d.gitHost.getAccount())
    await loadVerifiedSettings(setters)
    setters.setPaneState('connected')
    pullTokenAndStorage(setters)
    onSettingsUpdated()
    // A fresh token may unlock private lists that failed to resolve before, so re-resolve the catalog.
    refreshCatalog()
  } catch (failure) {
    setters.setError(errorMessage(failure))
    setters.setPaneState('disconnected')
  }
}

async function runDisconnect(setters: ConnectionSetters, refreshCatalog: () => void) {
  await window.b3d.gitHost.disconnect()
  setters.setAccount(null)
  setters.setConnectionRequest(null)
  setters.setTokenInfo(null)
  setters.setPaneState('disconnected')
  // Private lists that the token unlocked are no longer reachable; re-resolve so the catalog stays truthful.
  refreshCatalog()
}

export function useGitHostConnection(onSettingsUpdated: () => void) {
  const { refresh: refreshCatalog } = useCatalog()
  const [paneState, setPaneState] = useState<PaneState>('loading')
  const [account, setAccount] = useState<Account | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [connectionRequest, setConnectionRequest] = useState<ConnRequest | null>(null)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [storageEncrypted, setStorageEncrypted] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setters: ConnectionSetters = { setPaneState, setAccount, setSettings, setConnectionRequest, setTokenInfo, setStorageEncrypted, setError }

  function onMount() { loadInitialConnection(setters) }
  useEffect(onMount, [])

  async function connect(pat?: string) {
    await runConnect(setters, pat, refreshCatalog, onSettingsUpdated)
  }
  async function disconnect() {
    await runDisconnect(setters, refreshCatalog)
  }
  async function saveSettings(updated: Settings) {
    await window.b3d.gitHost.writeSettings(updated)
    setSettings(updated)
    onSettingsUpdated()
  }

  return { paneState, account, settings, connectionRequest, tokenInfo, storageEncrypted, error, connect, disconnect, saveSettings }
}
