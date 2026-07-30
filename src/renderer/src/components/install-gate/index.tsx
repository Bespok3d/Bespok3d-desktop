// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCatalog } from '../../data/catalog'
import { MovedVersionsDialog } from './MovedVersionsDialog'
import { RefreshOfferDialog } from './RefreshOfferDialog'
import type { InstallGate } from '../../hooks/installGate'

// The two dialogs the install gate puts up, mounted once for the whole app. It sits here rather than at
// each install so the catalog re-read after a refresh is done by the same code that owns the catalog,
// and so the offer looks the same whether the install started from a plugin page, an update or a
// collection.
export function InstallGateModals({ gate }: { gate: InstallGate }) {
  const catalog = useCatalog()

  return (
    <>
      {(gate.step === 'offer' || gate.step === 'refreshing') && (
        <RefreshOfferDialog
          refreshedAt={gate.refreshedAt}
          refreshing={gate.step === 'refreshing'}
          onRefresh={() => gate.acceptRefresh(catalog.refresh)}
          onProceed={gate.proceedWithInstall}
          onCancel={gate.cancel}
        />
      )}
      {gate.step === 'moved' && (
        <MovedVersionsDialog moved={gate.moved} onConfirm={gate.proceedWithInstall} onCancel={gate.cancel} />
      )}
    </>
  )
}
