// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { Button } from '../../../common/Button'
import { Group } from '../../../common/Group'
import { useAsyncResource } from '../../../common/hooks/useAsyncResource'
import { useI18n } from '../../../../i18n/context'
import { errorMessage } from '../../../../utils/errorMessage'

export function PublishedKeysSection({ onImported }: { onImported: () => void }) {
  const { t } = useI18n()
  const { value: publishedKeys, error, reload } = useAsyncResource(() => window.b3d.keys.published(), [])
  const [profiles, setProfiles] = useState<string[]>([])
  const [searchedFingerprint, setSearchedFingerprint] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const missingKeys = (publishedKeys ?? []).filter((key) => !key.hasPrivateKey)

  async function searchProfiles(fingerprint: string) {
    setBusy(true)
    setActionError('')
    setSearchedFingerprint(fingerprint)
    setProfiles([])
    try {
      setProfiles(await window.b3d.keys.localProfiles(fingerprint))
    } catch (failure) {
      setActionError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  async function importFrom(profile: string, fingerprint: string, publicKey: string) {
    setBusy(true)
    setActionError('')
    try {
      await window.b3d.keys.importLocal(fingerprint, profile, publicKey)
      onImported()
      reload()
      setSearchedFingerprint(null)
    } catch (failure) {
      setActionError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  if (!publishedKeys?.length && !error) return null

  return (
    <Group title={t('keys.published_account')}>
      {error && <div className="set-empty">{errorMessage(error)}</div>}
      {(publishedKeys?.length ?? 0) > 0 && missingKeys.length === 0 && <div className="set-empty">{t('keys.all_private_present')}</div>}
      {missingKeys.map((key) => (
        <div key={key.fingerprint} className="set-row">
          <div className="set-row-text">
            <div className="set-row-label">{key.label}</div>
            <div className="set-row-hint mono">{key.fingerprint}</div>
            <div className="set-row-hint">{t('keys.private_missing')}</div>
            {searchedFingerprint === key.fingerprint && profiles.length === 0 && !busy && !actionError &&
              <div className="set-row-hint">{t('keys.local_not_found')}</div>}
            {searchedFingerprint === key.fingerprint && actionError && <div className="set-row-hint">{actionError}</div>}
          </div>
          <div className="set-row-control">
            {searchedFingerprint !== key.fingerprint &&
              <Button variant="outline" size="sm" disabled={busy} onClick={() => searchProfiles(key.fingerprint)}>{t('keys.find_local')}</Button>}
            {searchedFingerprint === key.fingerprint && profiles.map((profile) => (
              <Button key={profile} variant="outline" size="sm" disabled={busy}
                onClick={() => importFrom(profile, key.fingerprint, key.publicKey)}>{t('keys.import_from', { profile })}</Button>
            ))}
          </div>
        </div>
      ))}
    </Group>
  )
}
