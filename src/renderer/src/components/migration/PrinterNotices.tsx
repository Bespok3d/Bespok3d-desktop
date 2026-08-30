// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { Printer } from '../../data/types'
import { useCatalog } from '../../data/catalog'
import { installedOnPrinter } from '../../data/channels/updates'
import { useChannelPrefs } from '../common/hooks/useChannelPrefs'
import type { PluginMigration } from '../plugin-store/migrations'
import { migrationOffer, migrationNoticeShows } from './offer'
import { MigrationBanner } from './MigrationBanner'
import { MigrationDialog } from './MigrationDialog'

// The one notice line above the panes. A plugin caught mid-takeover outranks the standing banners
// about updates, because until it finishes the printer is running half of a plugin that no longer
// exists under that name; the banners about a printer that is broken or unreachable still come first,
// which is what `migrationNoticeShows` defers to.
export function PrinterNotices({ printer, savedPluginVars, onUpdateDaemon, onMigrate, standingBanners }: {
  printer: Printer | null
  savedPluginVars: Record<string, string>
  onUpdateDaemon: (printerId: string) => void
  onMigrate: (printerId: string, migration: PluginMigration) => void
  standingBanners: ReactNode
}) {
  const { plugins, collections } = useCatalog()
  const { ceilingFor, disabledChannels } = useChannelPrefs()
  const [explaining, setExplaining] = useState(false)
  // The change is offered as the version the user's own channel ceiling allows, exactly like any
  // other update: a user held to stable is never walked into a beta by a migration.
  const installed = printer ? installedOnPrinter(printer, ceilingFor, disabledChannels) : { versions: {} }
  const offer = migrationOffer(printer, collections, plugins, installed, savedPluginVars)
  if (!printer || !offer || !migrationNoticeShows(printer)) return <>{standingBanners}</>

  function startTheMove() {
    if (printer && offer) onMigrate(printer.id, offer.migration)
    setExplaining(false)
  }

  return (
    <>
      <MigrationBanner
        offer={offer}
        printerName={printer.nick || printer.model}
        onUpdateDaemon={() => onUpdateDaemon(printer.id)}
        onStart={() => setExplaining(true)}
      />
      {explaining && <MigrationDialog offer={offer} onConfirm={startTheMove} onCancel={() => setExplaining(false)} />}
    </>
  )
}
