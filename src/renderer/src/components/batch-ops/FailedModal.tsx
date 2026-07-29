// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { BatchReportModal } from './ReportModal'
import type { BatchVariant } from './variant'

// The third thing a batch op can end as, alongside the progress view and the results report: the
// printer would not take the call at all, so there are no per-plugin rows to report, only the reason.
const FAILED_TITLE: Record<BatchVariant, string> = {
  recovery: 'recovery_failed.title',
  update: 'update_failed.title',
  install: 'install_failed.title',
  uninstall: 'uninstall_failed.title',
}

// The printer's own words are the verdict. A refusal while a print is running already reads as a
// sentence (it names the services the batch would have restarted); anything else the printer says is
// shown as it came, because a user who cannot read it can at least quote it.
export function BatchFailedModal({ variant, reason, onClose }: { variant: BatchVariant; reason: string; onClose: () => void }) {
  const { t } = useI18n()

  return <BatchReportModal title={t(FAILED_TITLE[variant])} summary={reason} summaryTone="bad" size="size-sm" onClose={onClose} />
}
