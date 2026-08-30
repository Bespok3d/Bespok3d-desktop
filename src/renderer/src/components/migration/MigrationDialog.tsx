// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { ConfirmActionDialog } from '../common/overlay/ConfirmActionDialog'
import type { MigrationOffer } from './offer'
import { migrationCopyKey } from './copy'
import './migration.css'

// What the change is, before it runs, in the publisher's own words: the plugin it is about, whatever
// goes on with it, and the promise that the settings the user typed survive it. A removal the user did
// not ask for is never something to discover afterwards, and neither is a plugin that stops doing what
// it used to do. A change that brings nothing else with it shows no second list rather than an empty one.
export function MigrationDialog({ offer, onConfirm, onCancel }: {
  offer: MigrationOffer
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useI18n()

  return (
    <ConfirmActionDialog
      title={t(migrationCopyKey(offer, 'title'), { plugin: offer.migratingName })}
      summary={offer.summary}
      detail={t(migrationCopyKey(offer, 'settings_kept'))}
      confirmLabel={t(migrationCopyKey(offer, 'confirm'))}
      extra={(
        <div className="migration-lists">
          <p className="migration-heading">{t(migrationCopyKey(offer, 'going'))}</p>
          <ul className="migration-list"><li>{offer.migratingName}</li></ul>
          {offer.arrivingNames.length > 0 && (
            <>
              <p className="migration-heading">{t(migrationCopyKey(offer, 'arriving'))}</p>
              <ul className="migration-list">
                {offer.arrivingNames.map((name) => <li key={name}>{name}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
