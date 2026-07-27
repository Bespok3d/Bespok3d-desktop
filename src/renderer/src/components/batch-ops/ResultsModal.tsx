import type { PluginRecoveryResult, RecoverResult } from '@bespok3d/contract'
import { useI18n } from '../../i18n/context'
import { Explainer } from '../common/content/Explainer'
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

function RecoveryResultItem({ result }: { result: PluginRecoveryResult }) {
  const { t } = useI18n()
  const { pluginId, ok, skipped, reason, autoDeactivated, fixDetail } = result
  // A plugin a safety fixer disabled is highlighted so it stands out from the routine rows.
  if (autoDeactivated) {
    return (
      <div className="recovery-row warn">
        <span aria-hidden className="recovery-warn-icon">⚠</span>
        <Explainer brief={diagnosisText(t, reason)} detail={diagnosisText(t, fixDetail || reason)} />
      </div>
    )
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

export function OtaRecoveryResultsModal({ results, onClose, variant = 'recovery' }: { results: RecoverResult; onClose: () => void; variant?: BatchVariant }) {
  const { t } = useI18n()
  const prefix = RESULT_PREFIX[variant]
  const title = results.ok ? t(`${prefix}.title_ok`) : t(`${prefix}.title_errors`)
  const summary = results.ok ? t(`${prefix}.summary_ok`) : t(`${prefix}.summary_errors`)

  return (
    <BatchReportModal title={title} summary={summary} summaryTone={results.ok ? 'ok' : 'bad'} size="size-md" onClose={onClose}>
      <div className="recovery-list">
        {results.results.map((pluginResult) => (
          <RecoveryResultItem key={pluginResult.pluginId} result={pluginResult} />
        ))}
      </div>
    </BatchReportModal>
  )
}
