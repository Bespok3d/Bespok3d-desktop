// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import cx from '../../utils/cx'
import { Modal } from '../common/overlay/Modal'
import { UploadBar } from '../upload'
import { useListFollowsActiveRow } from './follow-active-row'
import { rowStatus, completedCount } from './progress'
import type { BatchProgressState, RowStatus } from './progress'

const ROW_GLYPH: Record<RowStatus, string> = { done: '✓', failed: '✕', installing: '', pending: '' }

function BatchRow({ pluginId, status, phaseLabel }: { pluginId: string; status: RowStatus; phaseLabel: string | null }) {
  return (
    <div className={cx('batch-row', status)}>
      <span className="batch-row-mark" aria-hidden>{ROW_GLYPH[status]}</span>
      <span className="batch-row-id">{pluginId}</span>
      {status === 'installing' && phaseLabel && <span className="batch-row-phase">{phaseLabel}</span>}
    </div>
  )
}

// The live batch-install modal: the ordered plugin list with each row ticking pending -> installing
// (with its current phase) -> done/failed, an "X of N" count, and a determinate bar. Replaces the bare
// spinner so a multi-plugin install shows real, moving progress.
export function BatchInstallProgress({ title, state }: { title: string; state: BatchProgressState }) {
  const { t } = useI18n()
  const total = state.ids.length
  const done = completedCount(state)
  const listRef = useListFollowsActiveRow(state.startedIndex)

  return (
    <Modal dismissable={false} className="batch-progress-modal">
      <div className="modal-head">
        <h2>{title}</h2>
        <p>{t('batch_progress.count', { done, total })}</p>
      </div>
      <UploadBar printerId={state.printerId} />
      <progress className="batch-progress-bar" value={done} max={total || 1} />
      <div className="batch-progress-list" ref={listRef}>
        {state.ids.map((pluginId, index) => (
          <BatchRow key={pluginId} pluginId={pluginId} status={rowStatus(state, index)} phaseLabel={state.phaseLabel} />
        ))}
        {state.restarting && (
          <div className="batch-row installing">
            <span className="batch-row-mark" aria-hidden />
            <span className="batch-row-id">{t('batch_progress.restarting')}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
