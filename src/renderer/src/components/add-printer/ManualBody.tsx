// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { AdapterSelect } from './AdapterSelect'
import './add-printer.css'

export interface ManualBodyProps {
  manualIp: string
  nick: string
  adapterId: string
  onIpChange: (value: string) => void
  onNickChange: (value: string) => void
  onAdapterChange: (value: string) => void
}

export function ManualBody({
  manualIp,
  nick,
  adapterId,
  onIpChange,
  onNickChange,
  onAdapterChange,
}: ManualBodyProps) {
  const { t } = useI18n()

  return (
    <div className="ap-body">
      <div className="field">
        <label>{t('add.ip_label')}</label>
        <input
          type="text"
          placeholder={t('add.ip_placeholder')}
          value={manualIp}
          onChange={(event) => onIpChange(event.target.value)}
          className="ap-field-input ap-field-mono"
          autoFocus
        />
      </div>
      <div className="field">
        <label>{t('add.nick_label')}</label>
        <input
          type="text"
          placeholder={t('add.nick_placeholder')}
          value={nick}
          onChange={(event) => onNickChange(event.target.value)}
          className="ap-field-input"
        />
      </div>
      <div className="field">
        <label>{t('add.adapter_label')}</label>
        <AdapterSelect adapterId={adapterId} onChange={onAdapterChange} />
      </div>
    </div>
  )
}
