// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../i18n/context'
import { Enrollment } from '../components/enrollment'
import { RequestAccessModal } from '../components/access/RequestAccessModal'
import { ConfirmActionDialog } from '../components/common/overlay/ConfirmActionDialog'
import { BatchOpModal } from '../components/batch-ops'
import { AddPrinter } from '../components/add-printer'
import { UpdateModal } from '../components/app-update/UpdateModal'
import { InstallGateModals } from '../components/install-gate'
import { UpdateConfirmGate } from '../components/update-confirm/UpdateConfirmGate'
import { useAppUpdate } from '../components/app-update/useAppUpdate'
import { EXPECTED_RESTART_GRACE_MS } from '../components/printer-banners'
import type { Printer } from '../data/types'
import type { DiscoveredPrinterRecord } from '../env'
import type { AppActions } from './callbacks'

export function AppModals({ actions, discovered, existingPrinters }: { actions: AppActions; discovered: DiscoveredPrinterRecord[]; existingPrinters: Printer[] }) {
  const { t } = useI18n()
  const appUpdate = useAppUpdate()
  const enrollModal = actions.enrollModal
  // One batch runs at a time, so all four modals are handed the same refusal and each shows it only
  // when it is the one that was refused.
  const refusal = { failure: actions.batchFailure, onDismissFailure: actions.dismissBatchFailure }

  return (
    <>
      {appUpdate.showModal && appUpdate.update && (
        <UpdateModal
          update={appUpdate.update}
          progressPercent={appUpdate.progressPercent}
          downloaded={appUpdate.downloaded}
          downloadRequested={appUpdate.downloadRequested}
          errorMessage={appUpdate.errorMessage}
          onInstall={appUpdate.installNow}
          onDownload={appUpdate.download}
          onOpenDownload={appUpdate.openDownload}
          onLater={appUpdate.dismiss}
        />
      )}
      {enrollModal && (
        <Enrollment
          key={`${enrollModal.printer.id}-${enrollModal.mode}`}
          printer={enrollModal.printer}
          mode={enrollModal.mode}
          fromAdd={enrollModal.fromAdd}
          onEnrolled={actions.handleEnrolled}
          onClose={() => actions.setEnrollModal(null)}
          onEscalateRecovery={() => actions.handleRecoverPrinter(enrollModal.printer.id)}
          onExpectedRestart={(printerId) => actions.markExpectedRestart(printerId, EXPECTED_RESTART_GRACE_MS)}
        />
      )}
      {actions.accessModal && (
        <RequestAccessModal
          printer={actions.accessModal}
          onClose={() => actions.setAccessModal(null)}
          onGranted={actions.handleAccessGranted}
        />
      )}
      {actions.rootAccessGate && (
        <ConfirmActionDialog
          title={t('enroll.ssh_closed_title')}
          summary={t('enroll.ssh_closed_summary', { name: actions.rootAccessGate.printer.nick })}
          detail={t('enroll.ssh_closed_detail')}
          confirmLabel={t('enroll.ssh_retry')}
          onConfirm={actions.retryRootAccessGate}
          onCancel={() => actions.setRootAccessGate(null)}
        />
      )}
      {actions.enrollProposal && (
        <ConfirmActionDialog
          title={t('enroll.propose_title', { name: actions.enrollProposal.nick })}
          summary={t('enroll.propose_summary')}
          detail={t('enroll.propose_detail')}
          confirmLabel={t('enroll.propose_confirm')}
          onConfirm={actions.confirmEnrollProposal}
          onCancel={() => actions.setEnrollProposal(null)}
        />
      )}
      <UpdateConfirmGate pending={actions.pendingUpdate} printers={existingPrinters} onConfirm={actions.confirmUpdateAll} onCancel={actions.cancelUpdateAll} />
      <InstallGateModals gate={actions.installGate} />
      <BatchOpModal variant="recovery" busy={actions.recovering} result={actions.recoveryResults} {...refusal} onClose={() => actions.setRecoveryResults(null)} />
      <BatchOpModal variant="update" busy={actions.updatingAll} result={actions.updateAllResult} progress={actions.batchProgress} {...refusal} onClose={() => actions.setUpdateAllResult(null)} />
      <BatchOpModal variant="install" busy={actions.installingBatch} result={actions.installBatchResult} progress={actions.batchProgress} {...refusal} onClose={() => actions.setInstallBatchResult(null)} />
      <BatchOpModal variant="uninstall" busy={actions.uninstallingBatch} result={actions.uninstallBatchResult} {...refusal} onClose={() => actions.setUninstallBatchResult(null)} />
      {actions.addPrinterModal && (
        <AddPrinter
          initialTab={actions.addPrinterModal.tab}
          initialPickedId={actions.addPrinterModal.pickedId}
          discovered={discovered}
          existingPrinters={existingPrinters}
          onAdd={actions.handleAddPrinter}
          onClose={() => actions.setAddPrinterModal(null)}
        />
      )}
    </>
  )
}
