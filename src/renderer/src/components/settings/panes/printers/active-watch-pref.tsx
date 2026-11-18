// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The printer's active watch: whether it watches for faults, and what it does about each one.
import { useState } from 'react'
import { Toggle } from '../../../common/Toggle'
import { Segmented } from '../../../common/Segmented'
import { useAsyncResource } from '../../../common/hooks/useAsyncResource'
import { daemonTooOldForActiveWatch, KNOWN_REBOOT_TOKENS } from '../../../../data/active-watch'
import type { Printer } from '../../../../data/types'
import { useI18n } from '../../../../i18n/context'

function withRemedy(setting: ActiveWatchSetting, token: string, choice: ActiveWatchRemedyChoice): ActiveWatchSetting {
  return { ...setting, remedies: { ...setting.remedies, [token]: choice } }
}

// A daemon whose version is not known yet is asked; one too old for the watch answers nothing.
export function ActiveWatchPref({ printer }: { printer: Printer }) {
  if (printer.status !== 'managed' || daemonTooOldForActiveWatch(printer.daemonVersion)) return null

  return <ActiveWatchSettingRows printerId={printer.id} />
}

function ActiveWatchSettingRows({ printerId }: { printerId: string }) {
  const { t } = useI18n()
  const { value } = useAsyncResource(() => window.b3d.printers.activeWatchSetting(printerId), [printerId])
  const [saved, setSaved] = useState<ActiveWatchSetting | null>(null)
  const [saving, setSaving] = useState(false)
  const setting = saved ?? value
  if (!setting) return null

  // The switches move once the printer has saved the change, so they never show a choice it lacks.
  // They stay still while a save is on its way, so a second change is never built on a stale one.
  function save(next: ActiveWatchSetting): void {
    setSaving(true)
    window.b3d.printers.saveActiveWatchSetting(printerId, next)
      .then(setSaved)
      .catch((error) => console.warn('[active-watch] could not save the setting', error))
      .finally(() => setSaving(false))
  }
  const remedyOptions = [
    { value: 'notify' as const, label: t('printers.active_watch.notify'), disabled: saving },
    { value: 'reboot-when-idle' as const, label: t('printers.active_watch.reboot_when_idle'), disabled: saving },
  ]
  const wordedTokens = Object.keys(setting.remedies).filter((token) => KNOWN_REBOOT_TOKENS.includes(token))

  return (
    <>
      <div className="printer-ssh-pref">
        <span>
          <span className="printer-ssh-pref-label">{t('printers.active_watch')}</span>
          <span className="printer-ssh-pref-hint">{t('printers.active_watch_hint')}</span>
        </span>
        <Toggle on={setting.enabled} onChange={(enabled) => save({ ...setting, enabled })} disabled={saving} ariaLabel={t('printers.active_watch')} />
      </div>
      {setting.enabled && wordedTokens.map((token) => (
        <div key={token} className="printer-ssh-pref">
          <span className="printer-ssh-pref-label">{t(`printers.active_watch.token.${token}`)}</span>
          <Segmented value={setting.remedies[token]} options={remedyOptions} onChange={(choice) => save(withRemedy(setting, token, choice))} />
        </div>
      ))}
    </>
  )
}
