// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { Button } from '../common/Button'
import { PanelSpinner } from '../common/feedback/PanelSpinner'
import { Modal } from '../common/overlay/Modal'
import { formatElapsedHoursMinutes } from '../../utils/datetime'

// The question an install asks first: the plugin list is an hour old or older, so refresh it now or go
// ahead with the versions the list proposes. The two answers are named, because neither of them is a
// cancel: the install happens either way.
//
// While the refresh runs it stays on screen with the same question replaced by what is happening, so
// there is no second dialog and nothing jumps.
export function RefreshOfferDialog({ refreshedAt, refreshing, onRefresh, onProceed, onCancel }: {
  refreshedAt: number | null
  refreshing: boolean
  onRefresh: () => void
  onProceed: () => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const age = refreshedAt === null
    ? t('store.refresh_offer.never')
    : t('store.refresh_offer.aged', { age: formatElapsedHoursMinutes(Date.now() - refreshedAt) })

  return (
    <Modal onClose={onCancel} dismissable={!refreshing}>
      <div className="modal-head">
        <h2 className="dialog-title">{t('store.refresh_offer.title')}</h2>
        <p className="dialog-subtitle">{refreshing ? t('store.refresh_offer.working') : age}</p>
      </div>
      <div className="dialog-body snug">
        {refreshing && <PanelSpinner />}
        {!refreshing && (
          <div className="dialog-actions">
            <Button variant="outline" size="sm" onClick={onProceed}>{t('store.refresh_offer.proceed')}</Button>
            <Button variant="primary" size="sm" onClick={onRefresh}>{t('store.refresh_offer.refresh')}</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
