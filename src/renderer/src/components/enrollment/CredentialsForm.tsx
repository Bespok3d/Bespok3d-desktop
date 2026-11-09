// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useId, useRef } from 'react'
import type { SshCredentials } from '../../hooks/enrollment'
import { IconCheck, IconAlert } from '../../design-system/icons'
import { Button } from '../common/Button'
import { useAsyncResource } from '../common/hooks/useAsyncResource'
import { useI18n } from '../../i18n/context'
import { mainProcessMessage } from '../../utils/errorMessage'
import { failureInUserWords } from '../../utils/knownFailures'
import { STANDARD_SSH_PORT } from '../../../../main/printers/ports'
import './enrollment.css'

interface CredentialsFormProps {
  printerId: string
  ip: string
  adapterId: string
  actionLabel?: string
  onStart: (credentials: SshCredentials) => void
  onCancel: () => void
}

// A check keeps the login it tried, so its answer shows only while the fields still hold that login.
interface CheckState {
  status: 'idle' | 'checking' | 'ok' | 'err'
  failure?: string
  tried?: SshCredentials
}

const NO_CHECK: CheckState = { status: 'idle' }
const HIGHEST_PORT = 65535

function sameLogin(tried: SshCredentials | undefined, login: SshCredentials): boolean {
  return tried !== undefined && tried.user === login.user && tried.password === login.password && tried.port === login.port
}

function isPortNumber(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= HIGHEST_PORT
}

function checkOfLogin(check: CheckState, login: SshCredentials): CheckState {
  return sameLogin(check.tried, login) ? check : NO_CHECK
}

interface CredentialsFieldsProps {
  user: string; password: string; portText: string; check: CheckState; canStart: boolean
  onUser: (value: string) => void; onPassword: (value: string) => void
  onPort: (value: string) => void; onTest: () => void
}

function CredentialsFields({ user, password, portText, check, canStart, onUser, onPassword, onPort, onTest }: CredentialsFieldsProps) {
  const { t } = useI18n()
  const fieldId = useId()

  return (
    <div className="enroll-fields">
      <div className="enroll-field">
        <label htmlFor={`${fieldId}-password`}>{t('enroll.creds.password')}</label>
        <input id={`${fieldId}-password`} type="password" value={password} onChange={(event) => onPassword(event.target.value)} autoFocus />
      </div>
      <div className="enroll-row-fields">
        <div className="enroll-field">
          <label htmlFor={`${fieldId}-user`}>{t('enroll.creds.user')}</label>
          <input id={`${fieldId}-user`} type="text" value={user} onChange={(event) => onUser(event.target.value)} />
        </div>
        <div className="enroll-field">
          <label htmlFor={`${fieldId}-port`}>{t('enroll.creds.port')}</label>
          <input id={`${fieldId}-port`} type="number" value={portText} onChange={(event) => onPort(event.target.value)} min={1} max={HIGHEST_PORT} />
        </div>
      </div>
      <div className="u-row u-gap-3">
        <Button variant="outline" size="sm" onClick={onTest} disabled={check.status === 'checking' || !canStart}>
          {check.status === 'checking' ? t('enroll.creds.testing') : t('enroll.creds.test')}
        </Button>
        {check.status === 'ok' && <span className="enroll-connection-result ok"><IconCheck size={13} /> {t('enroll.creds.connected')}</span>}
        {check.status === 'err' && (
          <span className="enroll-connection-result err">
            <IconAlert size={13} /> {check.failure ? failureInUserWords(check.failure, t, check.tried?.port) : t('enroll.creds.failed')}
          </span>
        )}
      </div>
    </div>
  )
}

export function CredentialsForm({ printerId: _printerId, ip, adapterId, actionLabel, onStart, onCancel }: CredentialsFormProps) {
  const { t } = useI18n()
  // The adapter's defaults only fill a field the user has not typed in yet, however late they arrive.
  const [typedUser, setTypedUser] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [typedPort, setTypedPort] = useState<string | null>(null)
  const [check, setCheck] = useState<CheckState>(NO_CHECK)
  // Only the newest check may answer, so an older one that ends late never replaces its result.
  const newestCheck = useRef(0)
  const adapter = useAsyncResource(() => window.b3d.printers.adapterGet(adapterId), [adapterId])
  // The hook keeps the last adapter while a new one loads or fails, so its defaults count only once read.
  const adapterDefaults = adapter.loading || adapter.error ? undefined : adapter.value?.defaults
  const user = typedUser ?? adapterDefaults?.sshUser ?? ''
  // Until the adapter answers there is no port to show, so the field stays empty and nothing can run on a guess.
  const portText = typedPort ?? (adapter.loading ? '' : String(adapterDefaults?.sshPort ?? STANDARD_SSH_PORT))
  const port = Number(portText)
  const login = { user, password, port }

  function showCheck(checkNumber: number, outcome: CheckState) {
    if (checkNumber === newestCheck.current) setCheck(outcome)
  }
  function handleTestConnection() {
    var checkNumber = newestCheck.current + 1
    newestCheck.current = checkNumber
    setCheck({ status: 'checking', tried: login })
    window.b3d.printers.checkSsh(ip, user, password, port)
      .then((result) => showCheck(checkNumber, result.ok ? { status: 'ok', tried: login } : { status: 'err', failure: result.error, tried: login }))
      .catch((failure) => showCheck(checkNumber, { status: 'err', failure: mainProcessMessage(failure), tried: login }))
  }

  function handleStart() { onStart(login) }

  const canStart = user.trim() !== '' && password !== '' && isPortNumber(port)
  const explainEmptyLogin = !adapter.loading && !adapterDefaults && user.trim() === '' && port === STANDARD_SSH_PORT

  return (
    <>
      <div className="enroll-body">
        {explainEmptyLogin && <p className="u-hint-sm" role="status">{t('enroll.creds.no_defaults', { port: STANDARD_SSH_PORT })}</p>}
        <CredentialsFields
          user={user} password={password} portText={portText} check={checkOfLogin(check, login)} canStart={canStart}
          onUser={setTypedUser} onPassword={setPassword} onPort={setTypedPort} onTest={handleTestConnection}
        />
      </div>
      <div className="modal-foot">
        <Button variant="ghost" onClick={onCancel}>{t('btn.cancel')}</Button>
        <Button variant="primary" disabled={!canStart} onClick={handleStart}>{actionLabel ?? t('enroll.creds.start')}</Button>
      </div>
    </>
  )
}
