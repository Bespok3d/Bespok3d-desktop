// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCatalog } from '../../../data/catalog'
import { pluginUpdateCount } from '../../../data/channels/updates'
import { pendingUpdates } from '../../../data/printers'
import { useChannelPrefs } from '../../common/hooks/useChannelPrefs'
import type { Printer } from '../../../data/types'

interface PrinterUpdates {
  pluginUpdates: number
  daemonUpdate: boolean
}

const NO_UPDATES: PrinterUpdates = { pluginUpdates: 0, daemonUpdate: false }

// The pending-update counts for a printer (daemon firmware + plugin versions), read off the loaded
// catalog at the user's channel ceiling, so a newer build on a riskier channel than the user chose is
// never counted as an update. The trigger summary, each list row, and the footer all derive these, so
// they resolve through one hook instead of each calling useCatalog + pluginUpdateCount. Tolerates a
// null printer (the container resolves the selected printer after this hook must already have run).
export function usePrinterUpdates(printer: Printer | null): PrinterUpdates {
  const { plugins } = useCatalog()
  const { ceilingFor, disabledChannels } = useChannelPrefs()
  if (!printer) return NO_UPDATES

  return {
    pluginUpdates: pluginUpdateCount(printer, plugins, ceilingFor, disabledChannels),
    daemonUpdate: printer.daemonUpdateAvailable ?? false,
  }
}

// The three attention counts a trigger badge or hint shows: daemon + jinni (managed-gated, from
// pendingUpdates) and the plugin-update count. Shared so the badge and hint derive them identically.
export function useUpdateFlags(printer: Printer, adapterJinniVersion: string | undefined) {
  const { pluginUpdates } = usePrinterUpdates(printer)
  const { daemon, jinni } = pendingUpdates(printer, adapterJinniVersion)

  return { daemon, jinni, pluginUpdates }
}
