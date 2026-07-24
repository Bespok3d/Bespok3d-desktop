import { useState } from 'react'
import { EditableIcon } from '../../../common/editable-icon'
import { Row } from '../../../common/Row'
import { Button } from '../../../common/Button'
import { IconKey, IconTrash, IconAlert } from '../../../../design-system/icons'
import { Explainer } from '../../../common/content/Explainer'
import { PUBLISHER_REPO, keyFilePath, buildReadme } from '../../../../utils/publisherRepo'
import type { KeyRecord, KeyPurpose } from '../../../../data/keyTypes'
import { useI18n } from '../../../../i18n/context'
import type { KeyHandlers } from './key-handlers'
import { PurposeChip } from './PurposeChip'
import { DownloadFlyout } from './DownloadFlyout'
import { GitHostKeyFlyout } from './GitHostKeyFlyout'

export const KEY_PURPOSES: { id: KeyPurpose; labelKey: string }[] = [
  { id: 'printers', labelKey: 'keys.purpose.printers' },
  { id: 'packages', labelKey: 'keys.purpose.packages' },
  { id: 'lists', labelKey: 'keys.purpose.lists' },
  { id: 'contribution', labelKey: 'keys.purpose.contribution' },
]

function keyTypeLabel(typeId: string): string {
  if (typeId === 'gpg-p521') return 'GPG · P-521'
  if (typeId === 'gpg-p256') return 'GPG · P-256'
  if (typeId === 'gpg-ed25519') return 'GPG · Ed25519'

  return typeId
}

interface KeyRowProps extends KeyHandlers {
  keyRecord: KeyRecord
}

// Remove a key's published copy from the publisher repo and rewrite the README to drop it. Guard
// clauses fall through silently when there is nothing to purge (not connected, or never published).
async function purgePublishedKey(keyRecord: KeyRecord): Promise<void> {
  const [connected, account] = await Promise.all([
    window.b3d.gitHost.isConnected(),
    window.b3d.gitHost.getAccount(),
  ])
  if (!connected || !account) return
  const path = keyFilePath(keyRecord.fingerprint)
  const existing = await window.b3d.gitHost.getFile(account.login, PUBLISHER_REPO, path)
  if (!existing) return

  await window.b3d.gitHost.deleteFile(
    account.login, PUBLISHER_REPO, path,
    `Remove signing key ${keyRecord.fingerprintShort}`,
    existing.sha,
  )
  const allKeys = await window.b3d.keys.list()
  const entries = allKeys
    .filter((key) => key.id !== keyRecord.id && key.publishedAt)
    .map((key) => ({ label: key.label, fingerprint: key.fingerprint, date: key.publishedAt! }))
    .sort((entryA, entryB) => entryA.date.localeCompare(entryB.date))
  const readme = await window.b3d.gitHost.getFile(account.login, PUBLISHER_REPO, 'README.md')
  await window.b3d.gitHost.putFile(
    account.login, PUBLISHER_REPO, 'README.md',
    buildReadme(entries),
    `Remove ${keyRecord.label} from publisher keys`,
    readme?.sha,
  )
}

async function deleteKeyWithCleanup(keyRecord: KeyRecord, onRemove: (key: KeyRecord) => void, setDeleting: (v: boolean) => void): Promise<void> {
  setDeleting(true)
  try {
    await purgePublishedKey(keyRecord)
  } catch { /* best effort; local deletion proceeds regardless */ }
  onRemove(keyRecord)
}

interface KeyRowControlsProps {
  confirming: boolean; deleting: boolean; keyRecord: KeyRecord
  onSetPublishedAt: KeyRowProps['onSetPublishedAt']
  onConfirm: () => void; onCancelConfirm: () => void
}

function KeyRowControls({ confirming, deleting, keyRecord, onSetPublishedAt, onConfirm, onCancelConfirm }: KeyRowControlsProps) {
  const { t } = useI18n()

  if (confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={onCancelConfirm} disabled={deleting}>{t('btn.cancel')}</Button>
    )
  }

  return (
    <>
      <DownloadFlyout keyRecord={keyRecord} />
      <GitHostKeyFlyout keyRecord={keyRecord} onPublishedAt={(date) => onSetPublishedAt(keyRecord, date)} />
      <Button variant="ghost" size="sm" icon title={t('keys.row.remove_title')} onClick={onConfirm}>
        <IconTrash size={14} />
      </Button>
    </>
  )
}

export function KeyRow({ keyRecord, printers, gitHostSettings, allUserRepos, onRemove, onSetDefault, onSetAssignments, onSetIcon, onSetPublishedAt }: KeyRowProps) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleDelete() { deleteKeyWithCleanup(keyRecord, onRemove, setDeleting) }

  return (
    <Row
      className="key-row"
      icon={
        <EditableIcon
          defaultIcon={IconKey}
          color={keyRecord.iconColor}
          image={keyRecord.iconImage}
          size={keyRecord.iconSize}
          features={['zoom', 'color', 'image']}
          onColorChange={(color) => onSetIcon(keyRecord, color, keyRecord.iconImage, keyRecord.iconSize)}
          onImageChange={(image) => onSetIcon(keyRecord, keyRecord.iconColor, image, keyRecord.iconSize)}
          onSizeChange={(size) => onSetIcon(keyRecord, keyRecord.iconColor, keyRecord.iconImage, size)}
        />
      }
      controls={<KeyRowControls confirming={confirming} deleting={deleting} keyRecord={keyRecord}
        onSetPublishedAt={onSetPublishedAt} onConfirm={() => setConfirming(true)} onCancelConfirm={() => setConfirming(false)} />}
    >
      <div className="set-row-label">
        {keyRecord.label}
        {keyRecord.isDefault ? (
          <span className="key-default-badge">{t('keys.row.default')}</span>
        ) : (
          <button className="key-make-default" onClick={() => onSetDefault(keyRecord)}>
            {t('keys.row.make_default')}
          </button>
        )}
      </div>
      <div className="key-meta">
        <span>{keyTypeLabel(keyRecord.type)}</span>
        <span className="u-ink-4">·</span>
        <span>{t('keys.row.added', { date: keyRecord.addedAt })}</span>
        {keyRecord.publishedAt && (
          <>
            <span className="u-ink-4">·</span>
            <span>{t('keys.row.published', { date: keyRecord.publishedAt })}</span>
          </>
        )}
      </div>
      <div className="key-purposes">
        {KEY_PURPOSES.map((purposeDef) => (
          <PurposeChip
            key={purposeDef.id}
            purposeDef={purposeDef}
            keyRecord={keyRecord}
            printers={printers}
            gitHostSettings={gitHostSettings}
            allUserRepos={allUserRepos}
            onSetAssignments={onSetAssignments}
          />
        ))}
      </div>
      {confirming && (
        <div className="key-delete-confirm">
          <div className="key-delete-warn">
            <IconAlert size={13} />
            <Explainer
              brief={t('keys.row.delete_warn_brief')}
              detail={t('keys.row.delete_warn_detail')}
            />
          </div>
          <Button
            variant="danger-outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? t('keys.row.deleting') : t('keys.row.delete_permanent')}
          </Button>
        </div>
      )}
    </Row>
  )
}
