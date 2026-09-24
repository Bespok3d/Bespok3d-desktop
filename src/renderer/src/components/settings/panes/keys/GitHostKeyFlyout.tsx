// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import { Flyout } from '../../../common/overlay/Flyout'
import { Button } from '../../../common/Button'
import { IconGlobe, IconTrash, IconCheckCircle, IconAlert, IconExternalLink } from '../../../../design-system/icons'
import { useI18n } from '../../../../i18n/context'
import type { TFunction } from '../../../../i18n'
import type { KeyRecord } from '../../../../data/keyTypes'
import { PUBLISHER_REPO, keyFilePath, publisherRepoUrl } from '../../../../utils/publisherRepo'
import { publishPublisherKey, publishedKeyState, updatePublisherReadme } from './publisher-key'
import type { PublishedKeyState } from './publisher-key'
import './keys.css'

type PublishStatus = 'loading' | 'disconnected' | 'not-published' | 'mismatch' | 'published'
type ActionState = 'idle' | 'publishing' | 'unpublishing' | 'done' | 'error'

const PUBLISHED_STATES = {
  absent: 'not-published',
  matched: 'published',
  mismatch: 'mismatch',
} satisfies Record<PublishedKeyState, PublishStatus>

function actionTitle(actionState: ActionState, t: TFunction): string {
  if (actionState === 'publishing') return t('keys.publish.publishing')
  if (actionState === 'unpublishing') return t('keys.publish.unpublishing')
  if (actionState === 'done') return t('keys.publish.done')

  return t('keys.publish.error')
}

function actionStateIcon(actionState: ActionState) {
  if (actionState === 'done') return <IconCheckCircle size={13} />
  if (actionState === 'error') return <IconAlert size={13} />

  return <IconGlobe size={13} />
}

interface GitHostKeyFlyoutProps {
  keyRecord: KeyRecord
  onPublishedAt: (date: string | null) => void
}

function usePublishStatus(keyRecord: KeyRecord) {
  const [status, setStatus] = useState<PublishStatus>('loading')
  const [account, setAccount] = useState<GitHostAccount | null>(null)
  const [settings, setSettings] = useState<GitHostSettings | null>(null)

  async function load() {
    const [connected, settingsData, acct] = await Promise.all([
      window.b3d.gitHost.isConnected(),
      window.b3d.gitHost.settings(),
      window.b3d.gitHost.getAccount(),
    ]).catch(() => [false, null, null] as const)
    setSettings(settingsData)
    if (!connected || !acct) { setStatus('disconnected');

 return }
    setAccount(acct)
    try {
      const existing = await window.b3d.gitHost.getFile(
        acct.login, PUBLISHER_REPO, keyFilePath(keyRecord.fingerprint)
      )
      setStatus(PUBLISHED_STATES[publishedKeyState(existing?.content ?? null, keyRecord.publicKey)])
    } catch {
      setStatus('not-published')
    }
  }

  function onMount() { load() }
  useEffect(onMount, [])

  return { status, setStatus, account, settings }
}

function usePublishActions(
  keyRecord: KeyRecord,
  account: GitHostAccount | null,
  setStatus: (s: PublishStatus) => void,
  onPublishedAt: (date: string | null) => void
) {
  const [actionState, setActionState] = useState<ActionState>('idle')

  function resetAfterDelay() { setTimeout(() => setActionState('idle'), 2500) }

  async function doPublish() {
    if (!account) return
    setActionState('publishing')
    try {
      const date = await publishPublisherKey(keyRecord, account.login, window.b3d)
      onPublishedAt(date); setStatus('published'); setActionState('done'); resetAfterDelay()
    } catch { setActionState('error'); resetAfterDelay() }
  }

  async function doUnpublish() {
    if (!account) return
    setActionState('unpublishing')
    try {
      const path = keyFilePath(keyRecord.fingerprint)
      const existing = await window.b3d.gitHost.getFile(account.login, PUBLISHER_REPO, path)
      if (existing) {
        await window.b3d.gitHost.deleteFile(account.login, PUBLISHER_REPO, path, `Remove signing key ${keyRecord.fingerprintShort}`, existing.sha)
      }
      await updatePublisherReadme(keyRecord, account.login, null, window.b3d)
      await window.b3d.keys.setPublishedAt(keyRecord.id, null)
      onPublishedAt(null); setStatus('not-published'); setActionState('done'); resetAfterDelay()
    } catch { setActionState('error'); resetAfterDelay() }
  }

  return { actionState, doPublish, doUnpublish }
}

export function GitHostKeyFlyout({ keyRecord, onPublishedAt }: GitHostKeyFlyoutProps) {
  const { t } = useI18n()
  const { status, setStatus, account, settings } = usePublishStatus(keyRecord)
  const { actionState, doPublish, doUnpublish } = usePublishActions(keyRecord, account, setStatus, onPublishedAt)

  if (actionState !== 'idle') {
    return (
      <Button
        variant="ghost"
        size="sm"
        icon
        disabled
        title={actionTitle(actionState, t)}
      >
        {actionStateIcon(actionState)}
      </Button>
    )
  }

  if (status === 'loading') {
    return <Button variant="ghost" size="sm" icon disabled><IconGlobe size={13} /></Button>
  }

  if (status === 'disconnected') {
    return (
      <Button variant="ghost" size="sm" icon disabled title={t('keys.publish.connect_hint')}>
        <IconGlobe size={13} />
      </Button>
    )
  }

  if (status === 'mismatch') {
    return (
      <Button
        variant="ghost"
        size="sm"
        icon
        title={t('keys.publish.mismatch_to', { target: `${account?.login ?? '…'}/${PUBLISHER_REPO}` })}
      >
        <IconAlert size={13} />
      </Button>
    )
  }

  if (status === 'not-published') {
    return (
      <Button
        variant="ghost"
        size="sm"
        icon
        title={t('keys.publish.publish_to', { target: `${account?.login ?? '…'}/${PUBLISHER_REPO}` })}
        onClick={doPublish}
      >
        <IconGlobe size={13} />
      </Button>
    )
  }

  const url = settings && account ? publisherRepoUrl(settings, account.login) : null
  const target = `${account?.login}/${PUBLISHER_REPO}`

  return (
    <Flyout anchor={
      <Button
        variant="ghost"
        size="sm"
        icon
        title={t('keys.publish.published_to', { target })}
        className="key-published-icon"
      >
        <IconGlobe size={13} />
      </Button>
    }>
      <div className="flyout-note">{t('keys.publish.verified_to', { target })}</div>
      <button className="flyout-item" onClick={doUnpublish}>
        <IconTrash size={12} /> {t('keys.publish.unpublish')}
      </button>
      {url && (
        <button className="flyout-item" onClick={() => window.b3d.openUrl(url!)}>
          <IconExternalLink size={12} /> {t('keys.publish.open_browser')}
        </button>
      )}
    </Flyout>
  )
}
