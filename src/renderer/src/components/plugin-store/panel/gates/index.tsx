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

function DaemonGate({ plugin, daemonVersion, onConfirm, onCancel }: {
  plugin: Plugin; daemonVersion?: string; onConfirm: () => void; onCancel: () => void
}) {
  const { t } = useI18n()

  return (
    <ConfirmActionDialog
      title={t('store.daemon_too_old.title')}
      summary={t('store.daemon_too_old.summary', {
        plugin: plugin.title,
        required: plugin.minDaemonVersion ?? '',
        current: daemonVersion ?? '-',
      })}
      detail={t('store.daemon_too_old.detail')}
      confirmLabel={t('store.daemon_too_old.confirm')}
      danger
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

// The modal/dialog layer that sits over the panel: a hard install error, the daemon-too-old gate, the
// cascade-remove confirm, and the sideloaded-package removal dialog.
export function PanelGates({ plugin, printer, ops, daemonVersion, dependents, actions, localRemove, onClose }: {
  plugin: Plugin; printer?: Printer | null; ops: UsePluginOpsResult; daemonVersion?: string; dependents: string[]
  actions: ReturnType<typeof usePanelActions>; localRemove: ReturnType<typeof useLocalRemove>; onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <>
      {ops.phase === 'error' && (
        <InstallErrorModal plugin={plugin} printer={printer} kind={ops.errorKind} errorMsg={ops.errorMsg} onRetry={ops.retry} onClose={onClose} />
      )}
      {actions.showDaemonGate && (
        <DaemonGate plugin={plugin} daemonVersion={daemonVersion} onConfirm={actions.confirmDaemonGate} onCancel={() => actions.setShowDaemonGate(false)} />
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
