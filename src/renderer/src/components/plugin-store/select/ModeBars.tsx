// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'
import { ConfirmActionDialog } from '../../common/overlay/ConfirmActionDialog'
import { SelectActionBar } from './ActionBar'
import { BatchConfigModal } from './BatchConfigModal'
import type { useBatchInstall } from './useBatchInstall'
import type { useBatchUninstall } from './useBatchUninstall'

// The select-mode overlay layer: the install/uninstall action bar for the active mode, the cascade
// confirm a batch uninstall raises, and the install config-capture modal. One place so the store body
// stays under the size cap and the two mutually-exclusive modes render side by side.
export function SelectModeBars({ install, uninstall, installingSelected, uninstallingSelected, savedVars }: {
  install: ReturnType<typeof useBatchInstall>
  uninstall: ReturnType<typeof useBatchUninstall>
  installingSelected: boolean
  uninstallingSelected: boolean
  savedVars: Record<string, string>
}) {
  const { t } = useI18n()

  return (
    <>
      {install.active && (
        <SelectActionBar count={install.selectedIds.length} busy={installingSelected} primaryLabel={t('store.install_selected', { count: install.selectedIds.length })} onPrimary={install.begin} onClear={install.clear} onCancel={install.exit} />
      )}
      {uninstall.active && (
        <SelectActionBar count={uninstall.selectedIds.length} busy={uninstallingSelected} primaryLabel={t('store.uninstall_selected', { count: uninstall.selectedIds.length })} onPrimary={uninstall.begin} onClear={uninstall.clear} onCancel={uninstall.exit} />
      )}
      {uninstall.cascadeIds && (
        <ConfirmActionDialog
          title={t('store.uninstall_cascade.title')}
          summary={t('store.uninstall_cascade.summary', { plugins: uninstall.selectedIds.join(', '), deps: uninstall.cascadeIds.join(', ') })}
          detail={t('store.uninstall_cascade.detail')}
          confirmLabel={t('store.uninstall_cascade.confirm')}
          danger
          onConfirm={uninstall.confirmCascade}
          onCancel={uninstall.cancelCascade}
        />
      )}
      {install.configPlugins && (
        <BatchConfigModal plugins={install.configPlugins} savedVars={savedVars} busy={installingSelected} scopes={install.configScopes} onScopeChange={install.setConfigScope} onCancel={install.cancelConfig} onConfirm={install.confirmConfig} />
      )}
    </>
  )
}
