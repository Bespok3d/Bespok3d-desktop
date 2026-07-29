// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { useI18n } from '../../../../i18n/context'
import { Button } from '../../../common/Button'
import { IconGitBranch, IconCheckCircle, IconGitHub } from '../../../../design-system/icons'
import type { ConnRequest, PaneState } from './types'
import './git-host.css'

function ConnectBullets() {
  const { t } = useI18n()

  return (
    <div className="gh-connect-bullets">
      <div><IconCheckCircle size={12} /> {t('githost.connect.bullet.publish')}</div>
      <div><IconCheckCircle size={12} /> {t('githost.connect.bullet.keys')}</div>
      <div><IconCheckCircle size={12} /> {t('githost.connect.bullet.submit')}</div>
    </div>
  )
}

interface PatFormProps {
  onConnect: (pat: string) => void
  error: string | null
}

function PatForm({ onConnect, error }: PatFormProps) {
  const { t } = useI18n()
  const [pat, setPat] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pat.trim()) onConnect(pat.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="gh-pat-form">
      <input
        className="set-text gh-pat-input"
        type="password"
        placeholder={t('githost.pat.placeholder')}
        value={pat}
        onChange={(event) => setPat(event.target.value)}
        autoFocus
      />
      {error && (
        <p className="gh-form-error">{error}</p>
      )}
      <Button variant="primary" type="submit" disabled={!pat.trim()}>
        {t('githost.pat.connect')}
      </Button>
    </form>
  )
}

interface DeviceFlowFormProps {
  onConnect: () => void
  connectionRequest: ConnRequest | null
  error: string | null
}

function DeviceFlowForm({ onConnect, connectionRequest, error }: DeviceFlowFormProps) {
  const { t } = useI18n()
  if (connectionRequest) {
    return (
      <div className="gh-signin-body waiting">
        <div className="gh-waiting-ring">
          <span /><span /><span />
          <IconGitHub size={28} />
        </div>
        <p className="gh-waiting-note">
          {t('githost.connect.waiting')}
        </p>
        {connectionRequest.userCode && (
          <div className="gh-code-row centered">
            <span className="gh-code lg">{connectionRequest.userCode}</span>
          </div>
        )}
        {connectionRequest.verificationUrl && (
          <Button variant="outline" size="sm" onClick={() => window.b3d.openUrl(connectionRequest.verificationUrl ?? '')}>
            <IconGitHub size={13} /> {t('githost.connect.open_device')}
          </Button>
        )}
        {error && (
          <p className="gh-form-error">{error}</p>
        )}
      </div>
    )
  }

  return (
    <>
      {error && (
        <p className="gh-form-error">{error}</p>
      )}
      <Button variant="primary" onClick={onConnect}>
        <IconGitHub size={15} /> {t('githost.connect.github')}
      </Button>
    </>
  )
}

interface ConnectEmptyProps {
  isGitHub: boolean
  paneState: PaneState
  connectionRequest: ConnRequest | null
  error: string | null
  onConnect: (pat?: string) => void
}

export function ConnectEmpty({ isGitHub, paneState, connectionRequest, error, onConnect }: ConnectEmptyProps) {
  const { t } = useI18n()
  const host = isGitHub ? 'GitHub' : 'Gitea'

  return (
    <div className="gh-connect-empty">
      <div className="gh-octo lg">
        {isGitHub ? <IconGitHub size={36} /> : <IconGitBranch size={36} />}
      </div>
      <h3>{t('githost.connect.title', { host })}</h3>
      <p>{t('githost.connect.body', { host })}</p>
      <ConnectBullets />
      {paneState === 'connecting' && !isGitHub && (
        <div className="gh-waiting-text">
          <IconGitBranch size={15} /> {t('githost.connect.verifying')}
        </div>
      )}
      {(paneState === 'disconnected' || paneState === 'connecting') && isGitHub && (
        <DeviceFlowForm onConnect={() => onConnect()} connectionRequest={connectionRequest} error={error} />
      )}
      {paneState === 'disconnected' && !isGitHub && (
        <PatForm onConnect={onConnect} error={error} />
      )}
    </div>
  )
}
