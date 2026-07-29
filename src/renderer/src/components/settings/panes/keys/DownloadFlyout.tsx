// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Flyout } from '../../../common/overlay/Flyout'
import { Button } from '../../../common/Button'
import { IconDownload } from '../../../../design-system/icons'
import { useI18n } from '../../../../i18n/context'
import type { KeyRecord } from '../../../../data/keyTypes'

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportPublicKey(key: KeyRecord) {
  const content = await window.b3d.keys.export(key.id)
  downloadFile(content, `${key.label.replace(/\s+/g, '-')}.pub.asc`)
}

async function exportPrivateKey(key: KeyRecord) {
  const content = await window.b3d.keys.exportPrivate(key.id)
  downloadFile(content, `${key.label.replace(/\s+/g, '-')}.priv.asc`)
}

async function exportBothKeys(key: KeyRecord) {
  await exportPublicKey(key)
  await exportPrivateKey(key)
}

interface DownloadFlyoutProps {
  keyRecord: KeyRecord
}

export function DownloadFlyout({ keyRecord }: DownloadFlyoutProps) {
  const { t } = useI18n()

  return (
    <Flyout anchor={<Button variant="ghost" size="sm" title={t('keys.download')}><IconDownload size={13} /></Button>}>
      <button className="flyout-item" onClick={() => exportPublicKey(keyRecord)}>{t('keys.download_public')}</button>
      <button className="flyout-item" onClick={() => exportPrivateKey(keyRecord)}>{t('keys.download_private')}</button>
      <button className="flyout-item" onClick={() => exportBothKeys(keyRecord)}>{t('keys.download_both')}</button>
    </Flyout>
  )
}
