// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import cx from '../../utils/cx'
import { Explainer } from '../common/content/Explainer'
import { Button } from '../common/Button'
import { RebootProgress } from '../common/feedback/RebootProgress'
import { IconCheck, IconRefresh, IconAlert, IconCheckCircle, IconChevron } from '../../design-system/icons'
import { useI18n } from '../../i18n/context'
import type { SshCredentials } from '../../hooks/enrollment'
import type { EnrollMode } from './index'
import './enrollment.css'

interface SuccessCopy {
  titleKey: string
  subKey: string
}

const DEFAULT_SUCCESS: SuccessCopy = {
  titleKey: 'enroll.success.default.title',
  subKey: 'enroll.success.default.sub',
}

const SUCCESS_COPY: Partial<Record<EnrollMode, SuccessCopy>> = {
  uninstall: { titleKey: 'enroll.success.uninstall.title', subKey: 'enroll.success.uninstall.sub' },
  deactivate: { titleKey: 'enroll.success.deactivate.title', subKey: 'enroll.success.deactivate.sub' },
  reactivate: { titleKey: 'enroll.success.reactivate.title', subKey: 'enroll.success.reactivate.sub' },
  repair: { titleKey: 'enroll.success.repair.title', subKey: 'enroll.success.repair.sub' },
  reboot: { titleKey: 'enroll.success.reboot.title', subKey: 'enroll.success.reboot.sub' },
  recovery: { titleKey: 'enroll.success.recovery.title', subKey: 'enroll.success.recovery.sub' },
  'update-daemon': { titleKey: 'enroll.success.update_daemon.title', subKey: 'enroll.success.update_daemon.sub' },
  'update-jinni': { titleKey: 'enroll.success.update_jinni.title', subKey: 'enroll.success.update_jinni.sub' },
}

export function successCopy(mode: EnrollMode | undefined): SuccessCopy {
  return (mode && SUCCESS_COPY[mode]) || DEFAULT_SUCCESS
}

interface EnrollmentProgressProps {
  event: EnrollProgressEvent
  phase: 'enrolling' | 'success' | 'failed' | 'cancelled'
  onCancelOp: () => void
  onClose: () => void
  credentials?: SshCredentials
  onDone: () => void
  onRetry: (stepId: string) => void
  onReset: () => void
  onEscalate?: () => void
  mode?: EnrollMode
  printerIsRebooting?: boolean
  // Absent when there is no live restart to watch, as in the history view of a past enrollment.
  restartSeconds?: number
}

const REBOOT_STEP_ID = 'reboot-and-reconnect'

function StepIcon({ status }: { status: 'done' | 'running' | 'failed' }) {
  if (status === 'done') return <span className="enroll-step-icon done"><IconCheck size={13} /></span>
  if (status === 'running') return <span className="enroll-step-icon running"><span className="enroll-spin"><IconRefresh size={13} /></span></span>

  return <span className="enroll-step-icon failed"><IconAlert size={13} /></span>
}

function CompletedStepRows({ steps }: { steps: EnrollProgressEvent['completedSteps'] }) {
  return (
    <>
      {steps.map((step) => (
        <div key={step.id} className="enroll-step-row done">
          <StepIcon status="done" />
          <div className="enroll-step-content">
            <div className="enroll-step-label">
              <Explainer brief={step.label} detail={step.detail} />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

// What the printer already went through, under the outcome that ended the run.
function FinishedStepList({ steps }: { steps: EnrollProgressEvent['completedSteps'] }) {
  if (steps.length === 0) return null

  return (
    <div className="enroll-step-list u-mt-3">
      <CompletedStepRows steps={steps} />
    </div>
  )
}

function SuccessView({ event, message, onDone, printerIsRebooting }: { event: EnrollProgressEvent; message: SuccessCopy; onDone: () => void; printerIsRebooting?: boolean }) {
  const { t } = useI18n()

  return (
    <>
      <div className="enroll-body">
        <div className="enroll-success">
          <span className="enroll-success-icon"><IconCheckCircle size={32} /></span>
          <div className="enroll-success-title">{t(message.titleKey)}</div>
          <div className="enroll-success-sub">{t(message.subKey)}</div>
          {printerIsRebooting && <div className="enroll-success-sub">{t('enroll.success.printer_rebooting')}</div>}
        </div>
        <FinishedStepList steps={event.completedSteps} />
      </div>
      <div className="modal-foot">
        <Button variant="primary" onClick={onDone}>{t('enroll.progress.done')}</Button>
      </div>
    </>
  )
}

// Cancel stops the work at the next step boundary, so some steps did run. They are listed, because
// what was already done to the printer is the thing the user needs to know.
function CancelledView({ event, onClose }: { event: EnrollProgressEvent; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <>
      <div className="enroll-body">
        <div className="enroll-success">
          <div className="enroll-success-title">{t('enroll.cancelled.title')}</div>
          <div className="enroll-success-sub">{t('enroll.cancelled.sub')}</div>
        </div>
        <FinishedStepList steps={event.completedSteps} />
      </div>
      <div className="modal-foot">
        <Button variant="primary" onClick={onClose}>{t('btn.close')}</Button>
      </div>
    </>
  )
}

function EnrollFooter({ phase, stepId, onReset, onRetry, onEscalate, onCancelOp }: {
  phase: 'enrolling' | 'failed'
  stepId: string
  onReset: () => void
  onRetry: (stepId: string) => void
  onEscalate?: () => void
  onCancelOp: () => void
}) {
  const { t } = useI18n()
  const [moreOpen, setMoreOpen] = useState(false)
  const [cancelAsked, setCancelAsked] = useState(false)

  function askToCancel() {
    setCancelAsked(true)
    onCancelOp()
  }

  if (phase === 'enrolling') {
    return (
      <div className="modal-foot">
        <Button variant="ghost" disabled={cancelAsked} onClick={askToCancel}>
          {cancelAsked ? t('enroll.progress.cancelling') : t('btn.cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="modal-foot">
      <Button variant="ghost" className="u-mr-auto" onClick={onReset}>{t('btn.cancel')}</Button>
      <Button
        type="button"
        size="sm"
        className="link"
        onClick={() => setMoreOpen((isOpen) => !isOpen)}
        aria-expanded={moreOpen}
      >
        {t('enroll.progress.more')}
        <span className={cx('enroll-expand-icon', 'enroll-chevron-gap', moreOpen && 'open')}>
          <IconChevron size={12} />
        </span>
      </Button>
      {moreOpen && (
        <>
          <Button variant="outline" onClick={() => onRetry(stepId)}>{t('enroll.progress.start_from_step')}</Button>
          <Button variant="outline" onClick={onReset}>{t('enroll.progress.start_over')}</Button>
        </>
      )}
      {onEscalate && (
        <Button variant="primary" onClick={onEscalate}>{t('enroll.progress.run_recovery')}</Button>
      )}
    </div>
  )
}

// A step that is running has started, so the bar shows it half done rather than sitting at nothing.
// Deactivate and reactivate are three or four long steps, and counting only finished ones left the bar
// empty and still for the whole first step, which reads as an app that has hung.
// A step that reports how far into itself it is (uploading file 117 of 123) moves the bar by that
// instead: the half-step guess is only for a step with nothing to count.
export function progressFill(stepsDone: number, stepsTotal: number, stepRunning: boolean, stepFraction?: number): number {
  if (stepsTotal <= 0) return 0
  const intoStep = Math.min(1, Math.max(0, stepFraction ?? 0.5))

  return Math.round(((stepsDone + (stepRunning ? intoStep : 0)) / stepsTotal) * 100)
}

export function EnrollmentProgress({ event, phase, credentials: _credentials, onDone, onRetry, onReset, onEscalate, onCancelOp, onClose, mode, printerIsRebooting, restartSeconds }: EnrollmentProgressProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(false)

  useEffect(() => setActing(false), [event.stepId])

  if (phase === 'success') return <SuccessView event={event} message={successCopy(mode)} onDone={onDone} printerIsRebooting={printerIsRebooting} />
  if (phase === 'cancelled') return <CancelledView event={event} onClose={onClose} />

  function handleReset() { setExpanded(false); setActing(true); onReset() }
  function handleRetry(stepId: string) { setExpanded(false); setActing(true); onRetry(stepId) }
  function handleEscalate() {
    if (!onEscalate) return
    setExpanded(false); setActing(true); onEscalate()
  }

  const showFailed = phase === 'failed' && !acting
  const currentStepStatus = showFailed ? 'failed' : 'running'
  const pct = progressFill(event.completedSteps.length, event.totalSteps, !showFailed, event.stepFraction)
  const detail = showFailed && event.errorDetail ? event.errorDetail : event.stepDetail
  const stepLabel = phase === 'failed' && acting ? t('enroll.progress.starting') : event.stepLabel

  return (
    <>
      <div className="enroll-body">
        <div className="enroll-progress">
          <div className="progress">
            <div className={cx('progress-bar', !showFailed && event.stepFraction === undefined && 'indeterminate')} style={{ width: `${pct}%` }} />
          </div>
          {event.stepId === REBOOT_STEP_ID && !showFailed && restartSeconds !== undefined && <RebootProgress restartSeconds={restartSeconds} />}
          {event.hint && <div className="enroll-hint">{event.hint}</div>}
          <div className="enroll-current-step">
            <div
              className="enroll-current-label"
              role="button"
              tabIndex={0}
              onClick={() => setExpanded((isOpen) => !isOpen)}
              onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter' || keyEvent.key === ' ') setExpanded((isOpen) => !isOpen) }}
            >
              <span className="enroll-current-label-text">
                <Explainer brief={stepLabel} detail={detail} />
              </span>
              <span className={cx('enroll-expand-icon', expanded && 'open')}>
                <IconChevron size={12} />
              </span>
            </div>
            {expanded && (
              <div className="enroll-step-list">
                <CompletedStepRows steps={event.completedSteps} />
                <div className={cx('enroll-step-row', currentStepStatus)}>
                  <StepIcon status={currentStepStatus} />
                  <div className="enroll-step-content">
                    <div className={cx('enroll-step-label', currentStepStatus)}>
                      <Explainer brief={stepLabel} detail={detail} />
                    </div>
                    {showFailed && event.error && (
                      <div className="enroll-step-error">
                        {event.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <EnrollFooter
        phase={showFailed ? 'failed' : 'enrolling'}
        stepId={event.stepId}
        onReset={handleReset}
        onRetry={handleRetry}
        onEscalate={onEscalate ? handleEscalate : undefined}
        onCancelOp={onCancelOp}
      />
    </>
  )
}
