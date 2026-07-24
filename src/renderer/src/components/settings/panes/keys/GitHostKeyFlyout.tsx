import { useState, useEffect } from 'react'
import { Flyout } from '../../../common/overlay/Flyout'
import { Button } from '../../../common/Button'
import { IconGlobe, IconTrash, IconCheckCircle, IconAlert, IconExternalLink } from '../../../../design-system/icons'
import { useI18n } from '../../../../i18n/context'
import type { TFunction } from '../../../../i18n'
import type { KeyRecord } from '../../../../data/keyTypes'
import { PUBLISHER_REPO, keyFilePath, publisherRepoUrl, buildReadme } from '../../../../utils/publisherRepo'
import './keys.css'

type PublishStatus = 'loading' | 'disconnected' | 'not-published' | 'published'
type ActionState = 'idle' | 'publishing' | 'unpublishing' | 'done' | 'error'

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

const PUBLISHER_REPO_DESC = 'Bespok3d publisher identity and signing keys'

// Publishing keys to the public publisher repo is disabled during the private testing phase so a
// tester cannot push a key online by accident. Flip to true to re-enable (with signing, post-beta).
const PUBLISHING_ENABLED = false

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
    ])
    setSettings(settingsData)
    if (!connected || !acct) { setStatus('disconnected');

 return }
    setAccount(acct)
    try {
      const existing = await window.b3d.gitHost.getFile(
        acct.login, PUBLISHER_REPO, keyFilePath(keyRecord.fingerprint)
      )
      setStatus(existing ? 'published' : 'not-published')
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

  async function updateReadme(owner: string, entry: { label: string; fingerprint: string; date: string } | null) {
    const allKeys = await window.b3d.keys.list()
    const otherPublished = allKeys
      .filter((key) => key.id !== keyRecord.id && key.publishedAt)
      .map((key) => ({ label: key.label, fingerprint: key.fingerprint, date: key.publishedAt! }))
    const entries = entry ? [...otherPublished, entry] : otherPublished
    entries.sort((entryA, entryB) => entryA.date.localeCompare(entryB.date))
    const existing = await window.b3d.gitHost.getFile(owner, PUBLISHER_REPO, 'README.md')
    await window.b3d.gitHost.putFile(
      owner, PUBLISHER_REPO, 'README.md', buildReadme(entries),
      entry ? `Add ${keyRecord.label} to publisher keys` : `Remove ${keyRecord.label} from publisher keys`,
      existing?.sha,
    )
  }

  async function doPublish() {
    if (!account) return
    setActionState('publishing')
    try {
      const repos = await window.b3d.gitHost.listRepos()
      if (!repos.some((repo) => repo.owner === account.login && repo.repo === PUBLISHER_REPO)) {
        await window.b3d.gitHost.createRepo(PUBLISHER_REPO, PUBLISHER_REPO_DESC)
      }
      const path = keyFilePath(keyRecord.fingerprint)
      const existing = await window.b3d.gitHost.getFile(account.login, PUBLISHER_REPO, path)
      await window.b3d.gitHost.putFile(account.login, PUBLISHER_REPO, path, keyRecord.publicKey, `Publish signing key ${keyRecord.fingerprintShort}`, existing?.sha)
      const date = new Date().toISOString().slice(0, 10)
      await updateReadme(account.login, { label: keyRecord.label, fingerprint: keyRecord.fingerprint, date })
      await window.b3d.keys.setPublishedAt(keyRecord.id, date)
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
      await updateReadme(account.login, null)
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

  if (status === 'not-published') {
    if (!PUBLISHING_ENABLED) {
      return (
        <Button variant="ghost" size="sm" icon disabled title={t('keys.publish.disabled_testing')}>
          <IconGlobe size={13} />
        </Button>
      )
    }

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

  return (
    <Flyout anchor={
      <Button
        variant="ghost"
        size="sm"
        icon
        title={t('keys.publish.published_to', { target: `${account?.login}/${PUBLISHER_REPO}` })}
        className="key-published-icon"
      >
        <IconGlobe size={13} />
      </Button>
    }>
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
