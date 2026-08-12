// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginRecoveryResult, RecoverResult } from '@bespok3d/contract'
import { useI18n } from '../../i18n/context'
import { Explainer } from '../common/content/Explainer'
import { Button } from '../common/Button'
import { BatchReportModal } from './ReportModal'
import { diagnosisText } from './diagnosis'
import './batch-ops.css'
import type { BatchVariant } from './variant'

type RowStatus = 'ok' | 'skipped' | 'failed'

const ROW_ICON: Record<RowStatus, string> = { ok: '✓', skipped: '−', failed: '✕' }
const ROW_COLOR: Record<RowStatus, string> = { ok: 'var(--green)', skipped: 'var(--ink-3)', failed: 'var(--red)' }

function rowStatus(ok: boolean, skipped: boolean): RowStatus {
  if (ok) return 'ok'

  return skipped ? 'skipped' : 'failed'
}

// A plugin that came back running, but not holding the files it shipped: another installed plugin
// edits them on the printer, and the printer keeps no packaged copy to put back. Recovery says so and
// leaves the plugin alone; only the user decides whether to reinstall it.
function ChangedFilesRow({ pluginId, onReinstall }: { pluginId: string; onReinstall: () => void }) {
  const { t } = useI18n()

  return (
    <div className="recovery-row warn">
      <span aria-hidden className="recovery-warn-icon">⚠</span>
      <span className="u-flex-1">
        <Explainer
          brief={t('recovery_results.files_changed', { plugin: pluginId })}
          detail={t('recovery_results.files_changed_detail', { plugin: pluginId })}
        />
      </span>
      <Button variant="outline" size="sm" onClick={onReinstall}>{t('btn.reinstall')}</Button>
    </div>
  )
}

function RecoveryResultItem({ result, onReinstall }: { result: PluginRecoveryResult; onReinstall: (pluginId: string) => void }) {
  const { t } = useI18n()
  const { pluginId, ok, skipped, reason, autoDeactivated, fixDetail, changedFiles } = result
  // A plugin a safety fixer disabled is highlighted so it stands out from the routine rows.
  if (autoDeactivated) {
    return (
      <div className="recovery-row warn">
        <span aria-hidden className="recovery-warn-icon">⚠</span>
        <Explainer brief={diagnosisText(t, reason)} detail={diagnosisText(t, fixDetail || reason)} />
      </div>
    )
  }
  if (changedFiles && changedFiles.length > 0) {
    return <ChangedFilesRow pluginId={pluginId} onReinstall={() => onReinstall(pluginId)} />
  }
  const status = rowStatus(ok, skipped)
  const icon = ROW_ICON[status]
  const iconColor = ROW_COLOR[status]

  return (
    <div className="recovery-row">
      <span style={{ color: iconColor, fontWeight: 600, width: 16 }}>{icon}</span>
      <span className="u-flex-1">{pluginId}</span>
      {!ok && reason && (
        <span className="u-hint">{diagnosisText(t, reason)}</span>
      )}
    </div>
  )
}

const RESULT_PREFIX: Record<BatchVariant, string> = {
  recovery: 'recovery_results',
  update: 'update_results',
  install: 'install_results',
  uninstall: 'uninstall_results',
}

export function OtaRecoveryResultsModal({ results, onOpenPlugin, onClose, variant = 'recovery', restarting }: { results: RecoverResult; onOpenPlugin: (pluginId: string) => void; onClose: () => void; variant?: BatchVariant; restarting?: boolean }) {
  const { t } = useI18n()
  const prefix = RESULT_PREFIX[variant]
  const title = results.ok ? t(`${prefix}.title_ok`) : t(`${prefix}.title_errors`)
  const summary = results.ok ? t(`${prefix}.summary_ok`) : t(`${prefix}.summary_errors`)
  function reinstallFromItsOwnPage(pluginId: string) {
    onOpenPlugin(pluginId)
    onClose()
  }

  return (
    <BatchReportModal title={title} summary={summary} summaryTone={results.ok ? 'ok' : 'bad'} size="size-md" onClose={onClose}>
      {restarting && <p className="u-hint">{t('recovery_results.restarting')}</p>}
      <div className="recovery-list">
        {results.results.map((pluginResult) => (
          <RecoveryResultItem key={pluginResult.pluginId} result={pluginResult} onReinstall={reinstallFromItsOwnPage} />
        ))}
      </div>
    </BatchReportModal>
  )
}
