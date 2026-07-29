// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { Group } from '../../common/Group'
import { Button } from '../../common/Button'
import { useAsyncEffect } from '../../common/hooks/useAsyncEffect'
import { errorMessage } from '../../../utils/errorMessage'
import { useI18n } from '../../../i18n/context'
import type { Printer } from '../../../data/types'

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

function resetAccess(printer: Printer, onDone: () => void, onError: (message: string) => void): void {
  window.b3d.printers.adapterGet(printer.adapter).then((info) => {
    if (!info) return
    window.b3d.printers
      .resetAccess(printer.id, printer.ip, info.defaults.sshUser, info.defaults.sshPasswordHint, info.defaults.sshPort)
      .then(onDone)
      .catch((failure) => onError(errorMessage(failure)))
  }).catch((failure) => onError(errorMessage(failure)))
}

function PrinterAccess({ printer, data, onRefresh }: { printer: Printer; data?: AccessData; onRefresh: () => void }) {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  function runPrivileged(action: Promise<unknown>) {
    action.then(() => { setError(null); onRefresh() }).catch((failure) => setError(errorMessage(failure)))
  }
  function grant(identity: string) { runPrivileged(window.b3d.access.grant(printer.id, identity)) }
  function revoke(identity: string) { runPrivileged(window.b3d.access.revoke(printer.id, identity)) }

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
        <Button variant="outline" size="sm" onClick={() => resetAccess(printer, () => { setError(null); onRefresh() }, setError)}>{t('access.reset')}</Button>
      </div>
      {error && <div className="set-error" role="alert">{error}</div>}
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
