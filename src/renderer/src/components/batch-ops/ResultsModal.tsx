// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react'
import type { PluginRecoveryResult } from '@bespok3d/contract'
import type { BatchResult, ManifestWarning } from '../../../../main/daemon-client/batch-result'
import { useI18n } from '../../i18n/context'
import { Explainer } from '../common/content/Explainer'
import { Button } from '../common/Button'
import { useClipboard } from '../common/hooks/useClipboard'
import { BatchReportModal } from './ReportModal'
import { buildBatchReport } from './report-text'
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

// A plugin the batch could not simply get through reads the same way whatever went wrong with it: a
// warning mark, one line saying what happened, and the printer's own words behind the disclosure. What
// differs is whether there is anything the user can do about it from here, so that is what the caller
// supplies.
function BatchWarningRow({ brief, detail, action }: { brief: string; detail: string; action?: ReactNode }) {
  return (
    <div className="recovery-row warn">
      <span aria-hidden className="recovery-warn-icon">⚠</span>
      <span className="u-flex-1">
        <Explainer brief={brief} detail={detail} />
      </span>
      {action}
    </div>
  )
}

// A plugin that came back running, but not holding the files it shipped: another installed plugin
// edits them on the printer, and the printer keeps no packaged copy to put back. Recovery says so and
// leaves the plugin alone; only the user decides whether to reinstall it.
function ChangedFilesRow({ pluginId, onReinstall }: { pluginId: string; onReinstall: () => void }) {
  const { t } = useI18n()

  return (
    <BatchWarningRow
      brief={t('recovery_results.files_changed', { plugin: pluginId })}
      detail={t('recovery_results.files_changed_detail', { plugin: pluginId })}
      action={<Button variant="outline" size="sm" onClick={onReinstall}>{t('btn.reinstall')}</Button>}
    />
  )
}

// A plugin the printer walked past because it could not read the plugin's own manifest. Nothing was
// installed, updated or removed for it, so it is not a row of the batch: it is the printer naming the
// one plugin it cannot account for, alongside what it could not make sense of. There is nothing to
// offer the user here: the plugin's own files are what has to be put right.
function UnreadablePluginRow({ warning }: { warning: ManifestWarning }) {
  const { t } = useI18n()

  return (
    <BatchWarningRow
      brief={t('batch_results.unreadable_plugin', { plugin: warning.plugin })}
      detail={`${diagnosisText(t, warning.problem)} ${warning.detail}`}
    />
  )
}

function RecoveryResultItem({ result, onOpenPluginPage }: { result: PluginRecoveryResult; onOpenPluginPage: (pluginId: string) => void }) {
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
    return <ChangedFilesRow pluginId={pluginId} onReinstall={() => onOpenPluginPage(pluginId)} />
  }
  const status = rowStatus(ok, skipped)
  const icon = ROW_ICON[status]
  const iconColor = ROW_COLOR[status]
  // A plugin that did not go through and the printer said why. A plugin the printer simply walked past
  // says nothing and needs nothing: there is nothing for the user to put right.
  const needsPuttingRight = !ok && Boolean(reason)

  return (
    <div className="recovery-row">
      <span style={{ color: iconColor, fontWeight: 600, width: 16 }}>{icon}</span>
      <span className="u-flex-1">{pluginId}</span>
      {needsPuttingRight && (
        <span className="u-hint">{diagnosisText(t, reason)}</span>
      )}
      {/* A plugin that did not go through is a dead end in this list: the batch is over and it will not
          be retried. Its own page is where installing it resolves what it is missing, so that is the way
          out offered here, rather than leaving the user with a failed row and a Close button. A plugin
          the printer left out because something it needs is not there is the same dead end as one that
          failed outright, and its page is the same way out: it is where that missing plugin is fetched. */}
      {needsPuttingRight && (
        <Button variant="outline" size="sm" onClick={() => onOpenPluginPage(pluginId)}>{t('btn.fix')}</Button>
      )}
    </div>
  )
}

const RESULT_PREFIX: Record<BatchVariant, string> = {
  recovery: 'recovery_results',
  update: 'update_results',
  install: 'install_results',
  uninstall: 'uninstall_results',
  migration: 'migration_results',
  'migration-in-place': 'migration_change_results',
}

export function OtaRecoveryResultsModal({ results, onOpenPlugin, onClose, variant = 'recovery', restarting }: { results: BatchResult; onOpenPlugin: (pluginId: string) => void; onClose: () => void; variant?: BatchVariant; restarting?: boolean }) {
  const { t } = useI18n()
  const { copied, copy } = useClipboard()
  const prefix = RESULT_PREFIX[variant]
  const title = results.ok ? t(`${prefix}.title_ok`) : t(`${prefix}.title_errors`)
  const summary = results.ok ? t(`${prefix}.summary_ok`) : t(`${prefix}.summary_errors`)
  function openItsOwnPage(pluginId: string) {
    onOpenPlugin(pluginId)
    onClose()
  }
  // What the user can send on when the batch ends badly. The rows say what happened in the app's own
  // words; the report carries the printer's, for every plugin, which is what whoever reads the issue
  // needs and what a screenshot of this modal loses.
  const reportAction = results.ok ? undefined : (
    <Button variant="outline" size="sm" onClick={() => copy(buildBatchReport(variant, results))}>
      {copied ? t('install_error.copied') : t('install_error.copy')}
    </Button>
  )

  return (
    <BatchReportModal title={title} summary={summary} summaryTone={results.ok ? 'ok' : 'bad'} size="size-md" action={reportAction} onClose={onClose}>
      {restarting && <p className="u-hint">{t('recovery_results.restarting')}</p>}
      <div className="recovery-list">
        {results.manifestWarnings?.map((warning) => (
          <UnreadablePluginRow key={warning.plugin} warning={warning} />
        ))}
        {results.results.map((pluginResult) => (
          <RecoveryResultItem key={pluginResult.pluginId} result={pluginResult} onOpenPluginPage={openItsOwnPage} />
        ))}
      </div>
    </BatchReportModal>
  )
}
