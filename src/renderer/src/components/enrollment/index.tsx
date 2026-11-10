// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect, useRef } from 'react'
import type { Printer } from '../../data/types'
import { readPrinterLogin, usesTheirOwnLogin, type PrinterLogin } from '../../data/printers/login'
import { STANDARD_SSH_PORT } from '../../../../main/printers/ports'
import type { BatchResult } from '../../../../main/daemon-client/batch-result'
import { useEnrollment } from '../../hooks/enrollment'
import type { SshCredentials, EnrollState } from '../../hooks/enrollment'
import { useI18n } from '../../i18n/context'
import { formatDateTime } from '../../utils/datetime'
import { mainProcessMessage } from '../../utils/errorMessage'
import { knownFailureKey } from '../../utils/knownFailures'
import cx from '../../utils/cx'
import { Modal } from '../common/overlay/Modal'
import { Button } from '../common/Button'
import { CredentialsForm } from './CredentialsForm'
import { EnrollmentProgress } from './EnrollmentProgress'
import { nextStepAfterFailure } from './failure-escalation'
import type { FailureEscalation } from './failure-escalation'
import { buildHistoryEvent } from './history-event'
import { reportOpFailure } from './failure-report'
import { GoAheadStep } from './GoAheadStep'
import { usePostOpReboot, postOpRebootCalls } from './usePostOpReboot'
import { useOpOutcome } from './useOpOutcome'
import { useGoAhead, autoStartEligible } from './useGoAhead'
import './enrollment.css'

export type EnrollMode =
  | 'enroll'
  | 'history'
  | 'update-daemon'
  | 'update-jinni'
  | 'recovery'
  | 'repair'
  | 'deactivate'
  | 'reactivate'
  | 'uninstall'
  | 'reboot'

interface EnrollmentProps {
  printer: Printer
  mode: EnrollMode
  fromAdd?: boolean
  // Launched from the Force menu: run it even though the printer reports a newer daemon than this app
  // ships. A running print still refuses.
  forced?: boolean
  onEnrolled: (updated: Printer) => void
  onClose: () => void
  onEscalateRecovery?: () => void
  // Offered when the full recovery itself fails: re-enrol the printer and put every plugin back.
  onRebuildPrinter?: () => void
  onExpectedRestart?: (printerId: string) => void
  // The op is done and saved, but the window stays up on the printer's reboot: show the app the printer as it now is.
  onOpRecorded?: (updated: Printer) => void
  // Restarting the plugins switched off the ones the printer could not put back: show which.
  onPluginsLeftOff?: (reapplied: BatchResult) => void
}

const DAEMON_RESTART_MODES: ReadonlySet<EnrollMode> = new Set<EnrollMode>(['update-daemon', 'update-jinni', 'repair', 'reactivate', 'recovery', 'enroll', 'reboot'])

export function isDaemonRestartMode(mode: EnrollMode): boolean {
  return DAEMON_RESTART_MODES.has(mode)
}

function EnrollModalTitle({ printer, mode, fromAdd, bundledJinniVersion }: { printer: Printer; mode: EnrollMode; fromAdd: boolean; bundledJinniVersion?: string }) {
  const printerLabel = printer.nick || printer.model
  if (mode === 'deactivate') return (
    <>
      <h2>Deactivate {printerLabel}</h2>
      <p>Plugin services stop and the boot hook is removed. The printer restarts, and keeps printing on its own firmware.</p>
    </>
  )
  if (mode === 'reactivate') return (
    <>
      <h2>Reactivate {printerLabel}</h2>
      <p>Your plugins are put back and the daemon starts again. The printer restarts to pick them up.</p>
    </>
  )
  if (mode === 'reboot') return (
    <>
      <h2>Restart {printerLabel}</h2>
      <p>The printer powers down now and comes back on its own.</p>
    </>
  )
  if (mode === 'uninstall') return (
    <>
      <h2>Remove Bespok3d from {printerLabel}</h2>
      <p>Every plugin is uninstalled and the Bespok3d workspace is removed. The printer restarts and goes back to how it came.</p>
    </>
  )
  if (mode === 'recovery') return (
    <>
      <h2>Recover {printerLabel}</h2>
      <p>A firmware update reset this printer, so a daemon repair would not stick. Re-enroll to rebuild the daemon and boot hooks; your plugins are re-applied automatically.</p>
    </>
  )
  if (mode === 'repair') return (
    <>
      <h2>Repair {printerLabel}</h2>
      <p>Bespok3d found a problem with the daemon. A fresh daemon goes on, the old files are cleaned up, and your plugins are re-applied.</p>
    </>
  )
  if (mode === 'update-daemon') return (
    <>
      <h2>Update daemon: {printerLabel}</h2>
      <p>
        Update to <span className="mono">{window.b3d.daemonExpectedVersion}</span>
        {printer.daemonVersion && <> from <span className="mono">{printer.daemonVersion}</span></>}.
        {' '}Re-upload daemon code and restart. Cert and plugins are untouched.
      </p>
    </>
  )
  if (mode === 'update-jinni') return (
    <>
      <h2>Update adapter: {printerLabel}</h2>
      <p>
        Update the adapter jinni{bundledJinniVersion && <> to <span className="mono">{bundledJinniVersion}</span></>}
        {printer.jinniVersion && printer.jinniVersion !== 'unknown' && <> from <span className="mono">{printer.jinniVersion}</span></>}.
        {' '}Re-upload only the device-side adapter and restart the daemon. Cert and plugins are untouched.
      </p>
    </>
  )
  if (fromAdd) return (
    <>
      <h2>{printerLabel} was added</h2>
      <p>Enroll it now to manage plugins. You can also do this later from Settings → Printers.</p>
    </>
  )

  return (
    <>
      <h2>Enroll {printerLabel}</h2>
      <p>Connect to <span className="mono">{printer.ip}</span> and install bespok3d.</p>
    </>
  )
}

function HistoryModal({ printer, onClose }: { printer: Printer; onClose: () => void }) {
  const event = buildHistoryEvent(printer)
  const enrolledAt = printer.enrollmentLog?.enrolledAt

  return (
    <Modal onClose={onClose} className="enrollment">
      <div className="modal-head">
        <h2>Enrollment history: {printer.nick || printer.model}</h2>
        {enrolledAt && <p>Enrolled {formatDateTime(enrolledAt)}</p>}
      </div>
      {event ? (
        <EnrollmentProgress event={event} phase="success" onDone={onClose} onRetry={() => {}} onStartOver={() => {}} onCancelOp={() => {}} onClose={onClose} />
      ) : (
        <div className="enroll-body">
          <p className="u-hint-sm">No enrollment log recorded.</p>
        </div>
      )}
    </Modal>
  )
}

const ACTION_LABELS: Partial<Record<EnrollMode, string>> = {
  'update-daemon': 'Update',
  'update-jinni': 'Update adapter',
  'repair': 'Repair daemon',
  'deactivate': 'Deactivate',
  'reactivate': 'Reactivate',
  'uninstall': 'Remove Bespok3d',
  'reboot': 'Restart the printer',
}

interface EnrollmentBodyProps {
  printer: Printer
  mode: EnrollMode
  state: EnrollState
  credentials: SshCredentials
  showCredentialsForm: boolean
  awaitingGoAhead: boolean
  onStart: (creds: SshCredentials) => void
  onGoAhead: () => void
  onOwnCredentials: () => void
  onClose: () => void
  onDone: () => void
  onRetry: (stepId: string) => void
  onStartOver: () => void
  onCancelOp: () => void
  escalation?: FailureEscalation
  printerIsRebooting: boolean
  restartSeconds?: number
}

function StartFailureWords({ startError, sshPort }: { startError: string; sshPort: number }) {
  const { t } = useI18n()
  const messageKey = knownFailureKey(startError, sshPort)

  return <p className={cx('u-hint-sm', !messageKey && 'mono')}>{messageKey ? t(messageKey) : startError}</p>
}

function EnrollmentBody(props: EnrollmentBodyProps) {
  const { t } = useI18n()
  const { latestEvent, startError } = props.state
  function reportThisFailure(): void {
    reportOpFailure(props.printer, props.mode, { stepLabel: latestEvent?.stepLabel, reason: latestEvent?.error ?? startError ?? '' })
  }
  if (props.awaitingGoAhead) return <GoAheadStep actionLabel={ACTION_LABELS[props.mode] ?? t('btn.update')} onConfirm={props.onGoAhead} onOwnCredentials={props.onOwnCredentials} onCancel={props.onClose} />
  if (props.showCredentialsForm) return (
    <CredentialsForm
      printerId={props.printer.id}
      ip={props.printer.ip}
      adapterId={props.printer.adapter}
      actionLabel={ACTION_LABELS[props.mode] ?? 'Start enrollment'}
      onStart={props.onStart}
      onCancel={props.onClose}
    />
  )
  if (latestEvent) return (
    <EnrollmentProgress
      event={latestEvent}
      phase={props.state.phase as 'enrolling' | 'success' | 'failed' | 'cancelled'}
      credentials={props.credentials}
      mode={props.mode}
      onDone={props.onDone}
      onRetry={props.onRetry}
      onStartOver={props.onStartOver}
      onCancelOp={props.onCancelOp}
      onClose={props.onClose}
      escalation={props.escalation}
      onReportIssue={reportThisFailure}
      printerIsRebooting={props.printerIsRebooting}
      restartSeconds={props.restartSeconds}
    />
  )

  if (startError) return (
    <div className="enroll-body">
      <p className="u-hint-sm">{t('enroll.start_failed')}</p>
      <StartFailureWords startError={startError} sshPort={props.credentials.port} />
      <div className="modal-foot">
        <Button variant="outline" onClick={reportThisFailure}>{t('enroll.report_issue')}</Button>
        <Button variant="outline" onClick={props.onClose}>{t('btn.close')}</Button>
      </div>
    </div>
  )

  // Cancel asks the printer to stop between steps, so it can only answer while the printer is
  // answering at all. Once it has gone quiet there is nothing left to cancel, and the way out is Close.
  return (
    <div className="enroll-body">
      <div className="progress">
        <div className="progress-bar indeterminate u-w-full" />
      </div>
      {props.state.silentSinceStart && <p className="u-hint-sm">{t('enroll.no_answer_yet')}</p>}
      <div className="modal-foot">
        <Button variant="outline" onClick={props.onCancelOp}>{t('btn.cancel')}</Button>
        {props.state.silentSinceStart && <Button variant="outline" onClick={props.onClose}>{t('btn.close')}</Button>}
      </div>
    </div>
  )
}

export function Enrollment({ printer, mode, fromAdd = false, forced = false, onEnrolled, onClose, onEscalateRecovery, onRebuildPrinter, onExpectedRestart, onOpRecorded, onPluginsLeftOff }: EnrollmentProps) {
  const { state, startEnrollment, retryFrom, startDeactivate, startReactivate, startUninstall, startReboot, startRepair, startUpdateDaemon, startUpdateJinni, reset, cancelOp, failStart } = useEnrollment(printer, forced, onPluginsLeftOff)
  const [credentials, setCredentials] = useState<SshCredentials>({ user: '', password: '', port: STANDARD_SSH_PORT })
  const [adapterInfo, setAdapterInfo] = useState<AdapterInfo | null>(null)
  const autoStarted = useRef(false)

  const rebootCalls = postOpRebootCalls(printer, startReboot, onExpectedRestart)
  const rebootAfterTheOp = usePostOpReboot({ printer, mode, phase: state.phase, credentials, ...rebootCalls })
  const outcome = useOpOutcome({ printer, phase: state.phase, waitsForTheReboot: rebootAfterTheOp.waitsForThePrinter, onEnrolled, onOpRecorded, onClose })

  function loadAdapterInfo() {
    window.b3d.printers.adapterGet(printer.adapter).then(setAdapterInfo).catch(adapterReadFailed)
  }
  useEffect(loadAdapterInfo, [])

  const opStarters: Partial<Record<EnrollMode, (creds: SshCredentials) => void>> = { 'update-daemon': startUpdateDaemon, 'update-jinni': startUpdateJinni, repair: startRepair, deactivate: startDeactivate, reactivate: startReactivate, uninstall: startUninstall, reboot: startReboot }

  function handleStart(creds: SshCredentials) {
    setCredentials(creds)
    if (onExpectedRestart && isDaemonRestartMode(mode)) onExpectedRestart(printer.id)
    const opStart = opStarters[mode]
    if (opStart) { opStart(creds);

 return }
    startEnrollment(creds)
  }
  // Every action here needs the printer's adapter to know how to log in. Without it there is nothing to
  // run, so name the adapter that could not be read instead of leaving a bar that will never move.
  function adapterReadFailed(error: unknown) {
    autoStarted.current = false
    failStart(mainProcessMessage(error))
  }
  // A printer with its own login waits on the credentials form instead, so only the factory login starts here.
  function startWithLogin(login: PrinterLogin) {
    if (login.source === 'adapter-missing') {
      adapterReadFailed(new Error(printer.adapter))

      return
    }
    if (login.source === 'factory') handleStart(login.credentials)
  }
  function autoStartWithDefaultCredentials() {
    if (!autoStartEligible(mode, usesTheirOwnLogin(printer)) || autoStarted.current) return
    autoStarted.current = true
    readPrinterLogin(printer).then(startWithLogin).catch(adapterReadFailed)
  }
  useEffect(autoStartWithDefaultCredentials, [])

  function startOnAdapterDefaults() {
    readPrinterLogin(printer).then(startWithLogin).catch(adapterReadFailed)
  }
  const goAhead = useGoAhead({
    mode, phase: state.phase,
    customSshCredentials: usesTheirOwnLogin(printer),
    startWithAdapterDefaults: startOnAdapterDefaults, clearTheOp: reset,
  })

  function handleRetry(stepId: string) {
    if (opStarters[mode]) runTheFailedOpAgain()
    else retryFrom(stepId, credentials)
  }
  function runTheFailedOpAgain() {
    if (rebootAfterTheOp.rebootStarted()) rebootCalls.startReboot(credentials)
    else handleStart(credentials)
  }
  // Start over goes back to the first screen. With none to show, a bar nothing drives would sit there, so it runs again.
  function handleStartOver() {
    if (goAhead.hasAFirstScreen && !rebootAfterTheOp.rebootStarted()) goAhead.backToTheFirstScreen()
    else runTheFailedOpAgain()
  }

  if (mode === 'history') return <HistoryModal printer={printer} onClose={onClose} />

  return (
    <Modal onClose={goAhead.dismissable ? outcome.closeTheWindow : undefined} className="enrollment">
      <div className="modal-head">
        <EnrollModalTitle printer={printer} mode={mode} fromAdd={fromAdd} bundledJinniVersion={adapterInfo?.jinniVersion} />
      </div>
      <EnrollmentBody
        printer={printer} mode={mode} state={state} credentials={credentials}
        showCredentialsForm={goAhead.showCredentialsForm} awaitingGoAhead={goAhead.awaiting}
        onStart={handleStart} onGoAhead={goAhead.give} onOwnCredentials={goAhead.askForOwnCredentials} onClose={outcome.closeTheWindow}
        onDone={outcome.reportDone} onRetry={handleRetry} onStartOver={handleStartOver} onCancelOp={cancelOp} escalation={nextStepAfterFailure(mode, onEscalateRecovery, onRebuildPrinter)}
        printerIsRebooting={rebootAfterTheOp.printerIsRebooting} restartSeconds={adapterInfo?.restartSeconds}
      />
    </Modal>
  )
}
