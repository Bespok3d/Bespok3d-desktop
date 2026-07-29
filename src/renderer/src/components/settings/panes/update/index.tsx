// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { ConfirmActionDialog } from '../../../common/overlay/ConfirmActionDialog'
import { useI18n } from '../../../../i18n/context'
import { useAppUpdate } from '../../../app-update/useAppUpdate'
import { useReleases, releaseVerb } from './releases'
import { useUpdatePrefs, UpdatePreferencesGroup } from './preferences'
import { UpdateStatusGroup } from './status-group'
import { WhatsNewGroup } from './whats-new'
import { useRollback, UpdateRollbackGroup } from './rollback'

// Composes the app-update sub-panels (status, what's new, preferences, rollback) and owns the
// pick-a-version confirm dialog.
export function UpdatePane() {
  const { t } = useI18n()
  const appUpdate = useAppUpdate()
  const { prefs, change } = useUpdatePrefs()
  const { releases, error: releasesError } = useReleases()
  const rollback = useRollback()
  const [rollbackTarget, setRollbackTarget] = useState<AppReleaseRow | null>(null)
  const canAutoInstall = window.b3d.appUpdate.canAutoInstall

  return (
    <>
      <UpdateStatusGroup appUpdate={appUpdate} />
      <WhatsNewGroup releases={releases} />
      {prefs && <UpdatePreferencesGroup prefs={prefs} onChange={change} canAutoInstall={canAutoInstall} />}
      <UpdateRollbackGroup releases={releases} releasesError={releasesError} rollback={rollback} onPick={setRollbackTarget} />
      {rollbackTarget && (
        <ConfirmActionDialog
          title={t(`set.update.pick_confirm_title_${releaseVerb(rollbackTarget)}`, { version: rollbackTarget.version })}
          summary={t('set.update.rollback_confirm_summary', { version: rollbackTarget.version })}
          detail={t('set.update.rollback_confirm_detail')}
          confirmLabel={t(`set.update.${releaseVerb(rollbackTarget)}`)}
          onConfirm={() => { void rollback.run(rollbackTarget); setRollbackTarget(null) }}
          onCancel={() => setRollbackTarget(null)}
        />
      )}
    </>
  )
}
