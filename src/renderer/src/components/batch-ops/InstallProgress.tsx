// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import cx from '../../utils/cx'
import { Modal } from '../common/overlay/Modal'
import { UploadBar } from '../upload'
import { useListFollowsActiveRow } from './follow-active-row'
import { completedCount, activeRowIndex, progressSteps } from './progress'
import type { TFunction } from '../../i18n'
import type { BatchProgressState, ProgressStep, RowStatus } from './progress'

const ROW_GLYPH: Record<RowStatus, string> = { done: '✓', skipped: '−', failed: '✕', installing: '', pending: '' }
const STEP_LABEL_KEY = { prepare: 'batch_progress.step_prepare', restart: 'batch_progress.step_restart' } as const

function BatchRow({ label, status, phaseLabel }: { label: string; status: RowStatus; phaseLabel: string | null }) {
  return (
    <div className={cx('batch-row', status)}>
      <span className="batch-row-mark" aria-hidden>{ROW_GLYPH[status]}</span>
      <span className="batch-row-id">{label}</span>
      {status === 'installing' && phaseLabel && <span className="batch-row-phase">{phaseLabel}</span>}
    </div>
  )
}

function stepLabel(step: ProgressStep, t: TFunction): string {
  return step.kind === 'plugin' ? step.pluginId : t(STEP_LABEL_KEY[step.kind])
}

// A plugin id can be any word, "restart" too, so plugin keys never share a namespace with the steps.
function stepKey(step: ProgressStep): string {
  return step.kind === 'plugin' ? `plugin:${step.pluginId}` : step.kind
}

// The live batch-install modal: getting ready, the ordered plugin list, then the services restart, each
// row ticking pending -> installing (with its current phase) -> done/skipped/failed, an "X of N" count,
// and a determinate bar. A row is always moving, so the run never looks stuck or finished early.
export function BatchInstallProgress({ title, state }: { title: string; state: BatchProgressState }) {
  const { t } = useI18n()
  const steps = progressSteps(state)
  const total = steps.length
  const done = completedCount(state)
  const listRef = useListFollowsActiveRow(activeRowIndex(steps))

  return (
    <Modal dismissable={false} className="batch-progress-modal">
      <div className="modal-head">
        <h2>{title}</h2>
        <p>{t('batch_progress.count', { done, total })}</p>
      </div>
      <UploadBar printerId={state.printerId} />
      <progress className="batch-progress-bar" value={done} max={total} />
      <div className="batch-progress-list" ref={listRef}>
        {steps.map((step) => (
          <BatchRow key={stepKey(step)} label={stepLabel(step, t)} status={step.status} phaseLabel={step.kind === 'plugin' ? state.phaseLabel : null} />
        ))}
      </div>
    </Modal>
  )
}
