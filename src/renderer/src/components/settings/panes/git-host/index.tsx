// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../../i18n/context'
import { PanelSpinner } from '../../../common/feedback/PanelSpinner'
import { useGitHostConnection } from './connection'
import { AccountSection } from './account'
import { RepoListSection } from './repos'
import { ConnectEmpty } from './connect-views'
import type { Account, Repo, Settings } from './types'

interface GitHostPaneProps {
  onSettingsUpdated: () => void
}

export function GitHostPane({ onSettingsUpdated }: GitHostPaneProps) {
  const { paneState, account, settings, connectionRequest, tokenInfo, storageEncrypted, error, connect, disconnect, saveSettings } =
    useGitHostConnection(onSettingsUpdated)

  const isGitHub = settings?.type === 'github'
  const hostLabel = isGitHub ? 'GitHub' : (settings?.giteaUrl ?? 'Gitea')

  if (paneState === 'loading') {
    return <PanelSpinner />
  }

  if (paneState === 'connected' && account && settings) {
    return (
      <ConnectedView
        account={account}
        settings={settings}
        hostLabel={hostLabel}
        isGitHub={isGitHub}
        tokenInfo={tokenInfo}
        storageEncrypted={storageEncrypted}
        onDisconnect={disconnect}
        onReauth={() => connect()}
        onSave={saveSettings}
      />
    )
  }

  return (
    <ConnectEmpty
      isGitHub={isGitHub}
      paneState={paneState}
      connectionRequest={connectionRequest}
      error={error}
      onConnect={connect}
    />
  )
}

interface ConnectedViewProps {
  account: Account
  settings: Settings
  hostLabel: string
  isGitHub: boolean
  tokenInfo: TokenInfo | null
  storageEncrypted: boolean
  onDisconnect: () => void
  onReauth: () => void
  onSave: (settings: Settings) => Promise<void>
}

function ConnectedView({ account, settings, hostLabel, isGitHub, tokenInfo, storageEncrypted, onDisconnect, onReauth, onSave }: ConnectedViewProps) {
  const { t } = useI18n()
  const pluginRepos = settings.pluginRepos ?? []
  const listRepos = settings.listRepos ?? []

  function addPluginRepo(repo: Repo) {
    return onSave({ ...settings, pluginRepos: [...pluginRepos, repo] })
  }
  function removePluginRepo(repo: Repo) {
    onSave({ ...settings, pluginRepos: pluginRepos.filter((existing) => existing !== repo) })
  }
  function addListRepo(repo: Repo) {
    return onSave({ ...settings, listRepos: [...listRepos, repo] })
  }
  function removeListRepo(repo: Repo) {
    onSave({ ...settings, listRepos: listRepos.filter((existing) => existing !== repo) })
  }

  return (
    <>
      <AccountSection
        account={account}
        hostLabel={hostLabel}
        tokenInfo={tokenInfo}
        isGitHub={isGitHub}
        storageEncrypted={storageEncrypted}
        onDisconnect={onDisconnect}
        onReauth={onReauth}
      />
      <RepoListSection title={t('githost.repos.plugins')} repos={pluginRepos} onRemove={removePluginRepo} onAdd={addPluginRepo} />
      <RepoListSection title={t('githost.repos.lists')} repos={listRepos} onRemove={removeListRepo} onAdd={addListRepo} />
    </>
  )
}
