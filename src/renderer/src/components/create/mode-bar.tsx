// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../../utils/cx'
import { useI18n } from '../../i18n/context'
import { IconBox, IconCode } from '../../design-system/icons'

export function ModeBar({ mode, onModeChange, printerName }: { mode: 'store' | 'create'; onModeChange: (mode: 'store' | 'create') => void; printerName?: string }) {
  const { t } = useI18n()

  return (
    <div className="mode-bar">
      <button className={cx('mode-tab', mode === 'store' && 'active')} onClick={() => onModeChange('store')}>
        <span className="mt-icon"><IconBox size={15} /></span> {t('mode.store')}
      </button>
      <button className={cx('mode-tab', mode === 'create' && 'active')} onClick={() => onModeChange('create')}>
        <span className="mt-icon"><IconCode size={15} /></span> {t('mode.create')}
      </button>
      <span className="mode-bar-spacer" />
      {mode === 'create' && printerName && (
        <span className="mode-bar-note">{t('mode.create_target', { printer: printerName })}</span>
      )}
    </div>
  )
}
