// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCatalog } from '../../data/catalog'
import { useChannelPrefs } from '../common/hooks/useChannelPrefs'
import { installedOnPrinter } from '../../data/channels/updates'
import type { Printer } from '../../data/types'
import type { PendingUpdate } from '../batch-ops/pending-update'
import { UpdateConfirmDialog } from './index'

// The dialog needs the catalog and the user's channel ceiling to read a batch back to them, and those
// live in context, not in the batch state. This is where the two meet; nothing shows until an update
// batch is actually waiting on the user.
export function UpdateConfirmGate({ pending, printers, onConfirm, onCancel }: {
  pending: PendingUpdate | null
  printers: Printer[]
  onConfirm: (specs: PluginUpdateSpec[]) => void
  onCancel: () => void
}) {
  const { plugins } = useCatalog()
  const { ceilingFor, disabledChannels } = useChannelPrefs()
  const printer = printers.find((candidate) => candidate.id === pending?.printerId)
  if (!pending || !printer) return null

  return (
    <UpdateConfirmDialog
      specs={pending.specs}
      plugins={plugins}
      installed={installedOnPrinter(printer, ceilingFor, disabledChannels)}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
