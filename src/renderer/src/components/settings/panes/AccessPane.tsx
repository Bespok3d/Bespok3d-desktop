// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { Group } from '../../common/Group'
import { Button } from '../../common/Button'
import { Modal } from '../../common/overlay/Modal'
import { CredentialsForm } from '../../enrollment/CredentialsForm'
import { useAsyncEffect } from '../../common/hooks/useAsyncEffect'
import { mainProcessMessage } from '../../../utils/errorMessage'
import { failureInUserWords } from '../../../utils/knownFailures'
import { useI18n } from '../../../i18n/context'
import type { Printer } from '../../../data/types'
import type { SshCredentials } from '../../../hooks/enrollment'
import { useResetAccess } from './useResetAccess'

interface ClientInfo { identity: string; role: string; label: string }
interface PendingInfo { identity: string; label: string; requested_at: string }
interface AccessData { clients: ClientInfo[]; pending: PendingInfo[] }

function shortId(identity: string): string {
  return identity.length > 18 ? `${identity.slice(0, 8)}...${identity.slice(-6)}` : identity
}

function ClientRow({ client, isSelf, onRevoke }: { client: ClientInfo; isSelf: boolean; onRevoke: () => void }) {
  const { t } = useI18n()

  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-row-label">{client.label || shortId(client.identity)} {isSelf && t('access.this_computer')}</div>
        <div className="set-row-hint">{client.role} - {shortId(client.identity)}</div>
      </div>
      {!isSelf && <Button variant="outline" size="sm" onClick={onRevoke}>{t('access.revoke')}</Button>}
    </div>
  )
}

function PendingRow({ pending, onGrant }: { pending: PendingInfo; onGrant: () => void }) {
  const { t } = useI18n()

  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-row-label">{pending.label || shortId(pending.identity)}</div>
        <div className="set-row-hint">{t('access.wants')} - {shortId(pending.identity)}</div>
      </div>
      <Button variant="primary" size="sm" onClick={onGrant}>{t('access.approve')}</Button>
    </div>
  )
}

// The app never stores a login the user gave, so a printer with its own SSH login is asked for it every reset.
function TheirLoginModal({ printer, onLogin, onCancel }: { printer: Printer; onLogin: (login: SshCredentials) => void; onCancel: () => void }) {
  const { t } = useI18n()

  return (
    <Modal onClose={onCancel} className="enrollment">
      <div className="modal-head">
        <h2>{t('access.reset')}</h2>
        <p>{printer.nick || printer.model}</p>
      </div>
      <CredentialsForm printerId={printer.id} ip={printer.ip} adapterId={printer.adapter} actionLabel={t('access.reset')}
        onStart={onLogin} onCancel={onCancel} />
    </Modal>
  )
}

function PrinterAccess({ printer, data, onRefresh }: { printer: Printer; data?: AccessData; onRefresh: () => void }) {
  const { t } = useI18n()
  const [problem, setProblem] = useState<string | null>(null)
  function actionDone() { setProblem(null); onRefresh() }
  const reset = useResetAccess(printer, { done: actionDone, problem: setProblem })
  function runPrivileged(action: Promise<unknown>) {
    action.then(actionDone).catch((failure) => setProblem(failureInUserWords(mainProcessMessage(failure), t)))
  }
  function grant(identity: string) { runPrivileged(window.b3d.access.grant(printer.id, identity)) }
  function revoke(identity: string) { runPrivileged(window.b3d.access.revoke(printer.id, identity)) }
  function startReset() {
    setProblem(null)
    reset.start()
  }

  return (
    <Group title={printer.nick || printer.model}>
      {(data?.pending ?? []).map((pending) => (
        <PendingRow key={pending.identity} pending={pending} onGrant={() => grant(pending.identity)} />
      ))}
      {(data?.clients ?? []).map((client) => (
        <ClientRow key={client.identity} client={client} isSelf={client.identity === printer.accessIdentity}
          onRevoke={() => revoke(client.identity)} />
      ))}
      {data && data.clients.length === 0 && <div className="set-empty">{t('access.no_clients')}</div>}
      <div className="set-row">
        <div className="set-row-text">
          <div className="set-row-hint">{t('access.reset_hint')}</div>
        </div>
        <Button variant="outline" size="sm" busy={reset.resetting} onClick={startReset}>{t('access.reset')}</Button>
      </div>
      {reset.resetting && <div className="set-row-hint" role="status">{t('access.resetting')}</div>}
      {problem && <div className="set-error" role="alert">{problem}</div>}
      {reset.askingTheirLogin && <TheirLoginModal printer={printer} onLogin={reset.resetWithTheirLogin} onCancel={reset.cancelTheirLogin} />}
    </Group>
  )
}

export function AccessPane({ printers }: { printers: Printer[] }) {
  const { t } = useI18n()
  const managed = printers.filter((printer) => printer.status === 'managed')
  const [data, setData] = useState<Record<string, AccessData>>({})
  async function loadOne(printer: Printer, stale: () => boolean) {
    const result = await window.b3d.access.clients(printer.id)
    if (stale()) return
    setData((prev) => ({ ...prev, [printer.id]: result }))
  }
  async function refresh(stale: () => boolean): Promise<void> {
    await Promise.all(managed.map((printer) => loadOne(printer, stale)))
  }
  function reload() {
    managed.forEach((printer) => loadOne(printer, () => false))
  }
  useAsyncEffect(refresh, [managed.length])

  return (
    <>
      {managed.length === 0 && <div className="set-empty">{t('access.no_managed')}</div>}
      {managed.map((printer) => (
        <PrinterAccess key={printer.id} printer={printer} data={data[printer.id]} onRefresh={reload} />
      ))}
    </>
  )
}
