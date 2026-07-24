import { useState, useEffect } from 'react'
import type { SshCredentials } from '../../hooks/enrollment'
import { IconCheck, IconAlert } from '../../design-system/icons'
import { Button } from '../common/Button'
import { useI18n } from '../../i18n/context'
import './enrollment.css'

interface CredentialsFormProps {
  printerId: string
  ip: string
  adapterId: string
  actionLabel?: string
  onStart: (credentials: SshCredentials) => void
  onCancel: () => void
}

interface CheckState {
  status: 'idle' | 'checking' | 'ok' | 'err'
  message?: string
}

interface CredentialsFieldsProps {
  user: string; password: string; port: number; check: CheckState; canStart: boolean
  onUser: (value: string) => void; onPassword: (value: string) => void
  onPort: (value: number) => void; onTest: () => void
}

function CredentialsFields({ user, password, port, check, canStart, onUser, onPassword, onPort, onTest }: CredentialsFieldsProps) {
  const { t } = useI18n()

  return (
    <div className="enroll-fields">
      <div className="enroll-field">
        <label>{t('enroll.creds.password')}</label>
        <input type="password" value={password} onChange={(event) => onPassword(event.target.value)} autoFocus />
      </div>
      <div className="enroll-row-fields">
        <div className="enroll-field">
          <label>{t('enroll.creds.user')}</label>
          <input type="text" value={user} onChange={(event) => onUser(event.target.value)} />
        </div>
        <div className="enroll-field">
          <label>{t('enroll.creds.port')}</label>
          <input type="number" value={port} onChange={(event) => onPort(Number(event.target.value))} min={1} max={65535} />
        </div>
      </div>
      <div className="u-row u-gap-3">
        <Button variant="outline" size="sm" onClick={onTest} disabled={check.status === 'checking' || !canStart}>
          {check.status === 'checking' ? t('enroll.creds.testing') : t('enroll.creds.test')}
        </Button>
        {check.status === 'ok' && <span className="enroll-connection-result ok"><IconCheck size={13} /> {t('enroll.creds.connected')}</span>}
        {check.status === 'err' && (
          <span className="enroll-connection-result err">
            <IconAlert size={13} /> {check.message ?? t('enroll.creds.failed')}
          </span>
        )}
      </div>
    </div>
  )
}

export function CredentialsForm({ printerId: _printerId, ip, adapterId, actionLabel, onStart, onCancel }: CredentialsFormProps) {
  const { t } = useI18n()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [port, setPort] = useState(22)
  const [check, setCheck] = useState<CheckState>({ status: 'idle' })

  function loadAdapterDefaults() {
    window.b3d.printers.adapterGet(adapterId).then((info) => {
      if (!info) return
      setUser(info.defaults.sshUser)
      setPort(info.defaults.sshPort)
      setPassword(info.defaults.sshPasswordHint)
    })
  }
  useEffect(loadAdapterDefaults, [adapterId])

  function handleTestConnection() {
    setCheck({ status: 'checking' })
    window.b3d.printers.checkSsh(ip, user, password, port).then((result) => {
      setCheck(result.ok ? { status: 'ok' } : { status: 'err', message: result.error })
    })
  }

  function handleStart() { onStart({ user, password, port }) }

  const canStart = user.trim() !== '' && password !== '' && port > 0

  return (
    <>
      <div className="enroll-body">
        <CredentialsFields
          user={user} password={password} port={port} check={check} canStart={canStart}
          onUser={setUser} onPassword={setPassword} onPort={setPort} onTest={handleTestConnection}
        />
      </div>
      <div className="modal-foot">
        <Button variant="ghost" onClick={onCancel}>{t('btn.cancel')}</Button>
        <Button variant="primary" disabled={!canStart} onClick={handleStart}>{actionLabel ?? t('enroll.creds.start')}</Button>
      </div>
    </>
  )
}
