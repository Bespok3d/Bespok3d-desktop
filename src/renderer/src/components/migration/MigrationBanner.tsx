// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { PrinterBanner } from '../common/PrinterBanner'
import type { MigrationOffer } from './offer'
import { migrationCopyKey } from './copy'

// The change, put in front of the user instead of left behind a badge they can ignore. A plugin
// mid-change is half on the printer, so this is not one more update to get round to: it is the app
// saying the printer is not finished yet. When the printer is not on a new enough Bespok3d service
// yet, the banner asks for that first rather than offering a move that would fail.
export function MigrationBanner({ offer, printerName, onUpdateDaemon, onStart }: {
  offer: MigrationOffer
  printerName: string
  onUpdateDaemon: () => void
  onStart: () => void
}) {
  const { t } = useI18n()
  if (!offer.daemonReady) {
    return (
      <PrinterBanner
        message={t(migrationCopyKey(offer, 'banner_needs_daemon'), { plugin: offer.migratingName, name: printerName })}
        actionLabel={t('migration.banner_daemon_action')}
        onAction={onUpdateDaemon}
      />
    )
  }

  return (
    <PrinterBanner
      message={t(migrationCopyKey(offer, 'banner_body'), { plugin: offer.migratingName, name: printerName })}
      actionLabel={t(migrationCopyKey(offer, 'banner_action'))}
      onAction={onStart}
    />
  )
}
