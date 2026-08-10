// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { Plugin, Printer } from '../../../../data/types'
import { useI18n } from '../../../../i18n/context'
import type { UsePluginOpsResult } from '../../../../hooks/pluginOps'
import { ConfirmActionDialog } from '../../../common/overlay/ConfirmActionDialog'
import { InstallErrorModal } from './InstallErrorModal'
import { LocalRemoveDialog, type LocalRemoveContext } from './LocalRemoveDialog'
import { usePanelActions } from '../actions'

// Drives the explained removal of a sideloaded package. onDone refreshes the catalog and closes the
// panel (the plugin may no longer exist once its sideloaded source is gone).
export function useLocalRemove(pluginId: string, onDone: () => void) {
  const [context, setContext] = useState<LocalRemoveContext | null>(null)
  function request() {
    window.b3d.localStore.removeContext(pluginId).then(setContext)
  }
  function confirm(uninstallFrom: string[]) {
    setContext(null)
    window.b3d.localStore.remove(pluginId, uninstallFrom).then(onDone)
  }

  return { context, request, confirm, cancel: () => setContext(null) }
}

// The printer declares a daemon floor this plugin needs, and would not say which daemon it is running.
// That is a question the app could not ask, not a bad pair, so it warns and lets the user decide. A pair
// the app CAN judge never reaches here: the Install button is dark and says both versions instead.
function DaemonVersionUnknownGate({ plugin, onConfirm, onCancel }: {
  plugin: Plugin; onConfirm: () => void; onCancel: () => void
}) {
  const { t } = useI18n()

  return (
    <ConfirmActionDialog
      title={t('store.daemon_unknown.title')}
      summary={t('store.daemon_unknown.summary', {
        plugin: plugin.title,
        required: plugin.minDaemonVersion ?? '',
      })}
      detail={t('store.daemon_unknown.detail', { required: plugin.minDaemonVersion ?? '' })}
      confirmLabel={t('store.daemon_unknown.confirm')}
      danger
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

// The modal/dialog layer that sits over the panel: a hard install error, the daemon-too-old gate, the
// cascade-remove confirm, and the sideloaded-package removal dialog.
export function PanelGates({ plugin, printer, ops, dependents, actions, localRemove, onClose }: {
  plugin: Plugin; printer?: Printer | null; ops: UsePluginOpsResult; dependents: string[]
  actions: ReturnType<typeof usePanelActions>; localRemove: ReturnType<typeof useLocalRemove>; onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <>
      {ops.phase === 'error' && (
        <InstallErrorModal plugin={plugin} printer={printer} kind={ops.errorKind} errorMsg={ops.errorMsg} onRetry={ops.retry} onClose={onClose} />
      )}
      {actions.showDaemonGate && (
        <DaemonVersionUnknownGate plugin={plugin} onConfirm={actions.confirmDaemonGate} onCancel={() => actions.setShowDaemonGate(false)} />
      )}
      {actions.showCascadeGate && (
        <ConfirmActionDialog
          title={t('store.cascade.title')}
          summary={t('store.cascade.summary', { plugin: plugin.title, deps: dependents.join(', ') })}
          detail={t('store.cascade.detail')}
          confirmLabel={t('store.cascade.confirm')}
          danger
          onConfirm={actions.confirmCascade}
          onCancel={() => actions.setShowCascadeGate(false)}
        />
      )}
      {localRemove.context && (
        <LocalRemoveDialog pluginTitle={plugin.title} context={localRemove.context} onRemove={localRemove.confirm} onCancel={localRemove.cancel} />
      )}
    </>
  )
}
