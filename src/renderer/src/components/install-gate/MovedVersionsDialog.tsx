// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { ConfirmActionDialog } from '../common/overlay/ConfirmActionDialog'
import { MOVED_VERSIONS_SUPPRESS_KEY } from '../../hooks/installGate'
import type { RefreshedVersion } from '../../../../main/registry/refresh-pass'

// What the refresh found, shown before the install goes ahead: which plugins have released something
// newer than the list said, and what the install will use instead. It is information and not a warning,
// so it carries the do-not-show-again choice; the install is still confirmed here, never behind the
// person's back.
export function MovedVersionsDialog({ moved, onConfirm, onCancel }: {
  moved: RefreshedVersion[]
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const rows = moved.map((row) => (
    <li key={row.pluginName}>
      {t('store.refresh_moved.row', { plugin: row.pluginName, listed: row.listedVersion, fresh: row.freshVersion })}
    </li>
  ))

  return (
    <ConfirmActionDialog
      title={t('store.refresh_moved.title')}
      summary={t('store.refresh_moved.summary')}
      detail={t('store.refresh_moved.detail')}
      confirmLabel={t('store.refresh_moved.confirm')}
      suppressKey={MOVED_VERSIONS_SUPPRESS_KEY}
      extra={<ul>{rows}</ul>}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
