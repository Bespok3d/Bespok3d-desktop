// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import { useI18n } from '../../i18n/context'
import { useScrimDismiss } from '../common/hooks/useScrimDismiss'
import { Button } from '../common/Button'
import { PatchSnapApp } from './patch-snap/PatchSnapApp'
import type { PatchSession, ApplyRequest } from './patch-snap/PatchSnapApp'
import { errorMessage } from '../../utils/errorMessage'
import './PatchSnapDialog.css'

export interface PatchConflict {
  patchId: string
  targetId: string
  targetName: string
  targetContent: string
  patchContent: string
}

interface Props {
  conflict: PatchConflict | null
  onResolved: (patchedContent: string) => void
  onCancel: () => void
}

export function PatchSnapDialog({ conflict, onResolved, onCancel }: Props) {
  const { t } = useI18n()
  const scrim = useScrimDismiss(onCancel)
  const [session, setSession] = useState<PatchSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!conflict) { setSession(null); setError(null);

 return }
    setSession(null)
    setError(null)
    window.b3d.devTools.patch
      .session(conflict.patchId, conflict.targetId, conflict.targetName, conflict.targetContent, conflict.patchContent)
      .then(setSession)
      .catch((err: unknown) => setError(errorMessage(err)))
  }, [conflict])

  if (!conflict) return null
  const activeConflict = conflict

  async function handleApply(req: ApplyRequest) {
    if (!session) return
    try {
      const patched = await window.b3d.devTools.patch.apply(req, activeConflict.targetContent, session.hunks)
      onResolved(patched)
    } catch (error) {
      setError(errorMessage(error))
    }
  }

  return (
    <div className="snap-scrim" {...scrim}>
      <div className="snap-modal" onClick={(clickEvent) => clickEvent.stopPropagation()}>
        {error && (
          <div className="snap-error">
            <strong>{t('patchsnap.error_loading_session')}</strong> {error}
            <br />
            <Button variant="outline" size="sm" onClick={onCancel} className="u-mt-3">{t('patchsnap.close')}</Button>
          </div>
        )}
        {!error && !session && <div className="snap-loading">{t('patchsnap.analysing')}</div>}
        {!error && session && <PatchSnapApp session={session} onApply={handleApply} onCancel={onCancel} />}
      </div>
    </div>
  )
}
