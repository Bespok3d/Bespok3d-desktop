// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { Button } from '../common/Button'
import { Explainer } from '../common/content/Explainer'
import { BatchReportModal } from './ReportModal'
import { daemonDriverMismatch, writtenForMachines } from '../../utils/daemonReason'
import type { BatchVariant } from './variant'

// The third thing a batch op can end as, alongside the progress view and the results report: the
// printer would not take the call at all, so there are no per-plugin rows to report, only the reason.
const FAILED_TITLE: Record<BatchVariant, string> = {
  recovery: 'recovery_failed.title',
  update: 'update_failed.title',
  install: 'install_failed.title',
  uninstall: 'uninstall_failed.title',
  migration: 'migration_failed.title',
  'migration-in-place': 'migration_change_failed.title',
}

// The verdict a user meets is a sentence. A refusal while a print is running is already one (it names
// the services the batch would have restarted), so it stays on screen as the printer wrote it. A
// stack trace or a socket code is not, and reads as Bespok3d itself being broken, so the sentence
// leads and the printer's own words wait one click away for whoever needs to quote them.
export function BatchFailedModal({ variant, reason, onRepairPrinter, onClose }: { variant: BatchVariant; reason: string; onRepairPrinter: () => void; onClose: () => void }) {
  const { t } = useI18n()
  const setupIsMismatched = daemonDriverMismatch(reason)
  const inMachineWords = writtenForMachines(reason)
  const repair = <Button size="sm" variant="primary" onClick={onRepairPrinter}>{t('batch_failed.repair')}</Button>

  return (
    <BatchReportModal
      title={t(FAILED_TITLE[variant])}
      summary={inMachineWords ? t('batch_failed.technical_reason') : reason}
      summaryTone="bad"
      size="size-sm"
      action={setupIsMismatched ? repair : undefined}
      onClose={onClose}
    >
      {setupIsMismatched && <p className="batch-failed-advice">{t('batch_failed.mismatch_advice')}</p>}
      {inMachineWords && (
        <p className="batch-failed-advice">
          <Explainer brief={t('batch_failed.printer_words')} detail={<code className="batch-failed-verbatim">{reason}</code>} />
        </p>
      )}
    </BatchReportModal>
  )
}
