// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'
import { Button } from '../../common/Button'
import type { Plugin, Printer } from '../../../data/types'
import { buildBugReport, repoIssueUrl } from './bug-report'
import { useBugReport } from './useBugReport'
import { BugReportModal } from './BugReportModal'
import type { SafetyNotice } from './notice'

export { SafetyNoticeOverlay } from './SafetyNoticeOverlay'

// Shown after a single-plugin op when a safety fixer disabled the plugin to keep the printer working.
// Progressive disclosure for the 3 user tiers: a reassuring headline + one action for the novice;
// the plain fact for the intermediate; the captured log + a ready-to-share report for the expert.
export function SafetyRecoveryModal({ notice, plugin, printer, onClose }: {
  notice: SafetyNotice; plugin?: Plugin; printer?: Printer | null; onClose: () => void
}) {
  const { t } = useI18n()
  const report = plugin
    ? buildBugReport({ plugin, printer, detail: notice.detail, log: notice.log })
    : `${notice.detail}\n\n${notice.log}`
  const issueUrl = plugin ? repoIssueUrl(plugin, `${notice.pluginId}: disabled by a safety check`, report) : null
  const { copied, copyReport, reportProblem } = useBugReport(report, issueUrl)

  return (
    <BugReportModal
      title={t('safety_recovery.title')}
      subtitle={t('safety_recovery.subtitle')}
      guidance={t('safety_recovery.guidance')}
      tech={report}
      onClose={onClose}
      callout={
        <div className="report-callout">
          <span aria-hidden className="report-callout-mark">⚠</span>
          <span>{notice.detail}</span>
        </div>
      }
      actions={
        <>
          <Button variant="primary" onClick={reportProblem}>
            {issueUrl ? t('safety_recovery.report') : t('safety_recovery.copy')}
          </Button>
          {issueUrl && (
            <Button variant="outline" onClick={copyReport}>
              {copied ? t('safety_recovery.copied') : t('safety_recovery.copy')}
            </Button>
          )}
        </>
      }
    />
  )
}
