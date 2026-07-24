import type { PluginRecoveryResult, RecoverResult } from '@bespok3d/contract'
import { useI18n } from '../../i18n/context'
import { Explainer } from '../common/content/Explainer'
import { Button } from '../common/Button'
import { Modal } from '../common/overlay/Modal'
import { diagnosisText } from './diagnosis'
import './batch-ops.css'

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

const RESULT_PREFIX: Record<'recovery' | 'update' | 'install' | 'uninstall', string> = {
  recovery: 'recovery_results',
  update: 'update_results',
  install: 'install_results',
  uninstall: 'uninstall_results',
}

export function OtaRecoveryResultsModal({ results, onClose, variant = 'recovery' }: { results: RecoverResult; onClose: () => void; variant?: 'recovery' | 'update' | 'install' | 'uninstall' }) {
  const { t } = useI18n()
  const prefix = RESULT_PREFIX[variant]
  const title = results.ok ? t(`${prefix}.title_ok`) : t(`${prefix}.title_errors`)
  const summary = results.ok ? t(`${prefix}.summary_ok`) : t(`${prefix}.summary_errors`)

  return (
    <Modal onClose={onClose} className="size-md">
      <div className="modal-head">
        <h2>{title}</h2>
        <p style={{ color: results.ok ? 'var(--green)' : 'var(--red)' }}>{summary}</p>
      </div>
      <div className="recovery-list">
        {results.results.map((pluginResult) => (
          <RecoveryResultItem key={pluginResult.pluginId} result={pluginResult} />
        ))}
      </div>
      <div className="recovery-foot">
        <Button size="sm" onClick={onClose}>{t('btn.close')}</Button>
      </div>
    </Modal>
  )
}
