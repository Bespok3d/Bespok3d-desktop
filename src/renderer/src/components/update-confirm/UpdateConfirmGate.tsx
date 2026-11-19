// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCatalog } from '../../data/catalog'
import { useChannelPrefs } from '../common/hooks/useChannelPrefs'
import { installedOnPrinter } from '../../data/channels/updates'
import type { Printer } from '../../data/types'
import type { PendingUpdate } from '../batch-ops/pending-update'
import type { UpdateAllPlan } from '../plugin-store/migrations'
import { BatchConfigModal } from '../plugin-store/select/BatchConfigModal'
import { replacedRows } from './rows'
import { useValuesCapture } from './values-capture'
import { UpdateConfirmDialog } from './index'

// The dialog needs the catalog and the user's channel ceiling to read a batch back to them, and those
// live in context, not in the batch state. This is where the two meet; nothing shows until an update
// batch is actually waiting on the user. A confirmed batch with a plugin still missing a required
// value asks for it before it goes out.
export function UpdateConfirmGate({ pending, printers, onConfirm, onCancel }: {
  pending: PendingUpdate | null
  printers: Printer[]
  onConfirm: (plan: UpdateAllPlan) => void
  onCancel: () => void
}) {
  const { plugins, collections } = useCatalog()
  const { ceilingFor, disabledChannels } = useChannelPrefs()
  const { capture, confirmPicked, confirmCaptured, cancelCapture } = useValuesCapture(pending, plugins, onConfirm, onCancel)
  const printer = printers.find((candidate) => candidate.id === pending?.printerId)
  if (!pending || !printer) return null
  if (capture) {
    return <BatchConfigModal plugins={capture.plugins} savedVars={{}} knownValues={capture.known} purpose="update" busy={false} onCancel={cancelCapture} onConfirm={confirmCaptured} />
  }
  const installed = installedOnPrinter(printer, ceilingFor, disabledChannels)

  return (
    <UpdateConfirmDialog
      specs={pending.plan.updates}
      replaced={replacedRows(pending.plan.migrations, collections, plugins, installed)}
      plugins={plugins}
      installed={installed}
      onConfirm={(specs) => confirmPicked(pending, specs)}
      onCancel={onCancel}
    />
  )
}
