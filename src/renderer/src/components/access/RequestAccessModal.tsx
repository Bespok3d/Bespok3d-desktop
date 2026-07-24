import { useState, useEffect } from 'react'
import type { Printer } from '../../data/types'
import { useI18n } from '../../i18n/context'
import { Modal } from '../common/overlay/Modal'
import { Button } from '../common/Button'
import { IconCheckCircle, IconAlert, IconRefresh } from '../../design-system/icons'
import { errorMessage } from '../../utils/errorMessage'
import '../enrollment/enrollment.css'

type Phase = 'choice' | 'waiting' | 'granted' | 'failed'

interface RequestAccessModalProps {
  printer: Printer
  onClose: () => void
  onGranted: (printerId: string) => void
}

const POLL_MS = 3000

const STEP_KEYS = ['access.step.request', 'access.step.open', 'access.step.approve']

function ChoiceView({ name, onStart }: { name: string; onStart: (guided: boolean) => void }) {
  const { t } = useI18n()

  return (
    <>
      <div className="enroll-body">
        <p>{t('access.choice.body', { name })}</p>
      </div>
      <div className="modal-foot">
        <Button variant="outline" onClick={() => onStart(false)}>{t('access.choice.steps_only')}</Button>
        <Button variant="primary" onClick={() => onStart(true)}>{t('access.choice.guide')}</Button>
      </div>
    </>
  )
}

function WaitingView({ guided, onCancel }: { guided: boolean; onCancel: () => void }) {
  const { t } = useI18n()

  return (
    <>
      <div className="enroll-body">
        <div className="enroll-success">
          <span className="enroll-spin"><IconRefresh size={28} /></span>
          <div className="enroll-success-title">{t('access.waiting.title')}</div>
          {guided && <div className="enroll-success-sub">{t('access.waiting.sub')}</div>}
        </div>
        <ol className="access-steps">
          {STEP_KEYS.map((key) => <li key={key}>{t(key)}</li>)}
        </ol>
      </div>
      <div className="modal-foot">
        <Button variant="outline" onClick={onCancel}>{t('access.cancel')}</Button>
      </div>
    </>
  )
}

function ResultView({ granted, error, onClose }: { granted: boolean; error: string; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <>
      <div className="enroll-body">
        <div className="enroll-success">
          <span className="enroll-success-icon">{granted ? <IconCheckCircle size={32} /> : <IconAlert size={32} />}</span>
          <div className="enroll-success-title">{granted ? t('access.granted.title') : t('access.failed.title')}</div>
          <div className="enroll-success-sub">{granted ? t('access.granted.sub') : error}</div>
        </div>
      </div>
      <div className="modal-foot">
        <Button variant="primary" onClick={onClose}>{t('access.done')}</Button>
      </div>
    </>
  )
}

export function RequestAccessModal({ printer, onClose, onGranted }: RequestAccessModalProps) {
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>('choice')
  const [guided, setGuided] = useState(true)
  const [error, setError] = useState('')

  function start(asGuided: boolean) {
    setGuided(asGuided)
    setPhase('waiting')
    window.b3d.access.request(printer.id, '').catch((requestError) => {
      setError(errorMessage(requestError))
      setPhase('failed')
    })
  }

  function pollForGrant() {
    if (phase !== 'waiting') return
    const timer = setInterval(() => {
      window.b3d.access.status(printer.id)
        .then((status) => { if (status === 'granted') setPhase('granted') })
        // A single tick failing is expected to be transient (the next 3s interval retries), so this does
        // not change phase; we log rather than swallow so a persistently-failing poll is visible.
        .catch((error) => console.warn('[access] grant poll tick failed', error))
    }, POLL_MS)

    return () => clearInterval(timer)
  }
  useEffect(pollForGrant, [phase, printer.id])

  function finish() {
    if (phase === 'granted') onGranted(printer.id)
    onClose()
  }

  return (
    <Modal onClose={phase === 'choice' ? onClose : undefined} className="enrollment">
      <div className="modal-head">
        <h2>{t('access.request.title', { name: printer.nick || printer.model })}</h2>
      </div>
      {phase === 'choice' && <ChoiceView name={printer.nick || printer.model} onStart={start} />}
      {phase === 'waiting' && <WaitingView guided={guided} onCancel={onClose} />}
      {(phase === 'granted' || phase === 'failed') &&
        <ResultView granted={phase === 'granted'} error={error} onClose={finish} />}
    </Modal>
  )
}
