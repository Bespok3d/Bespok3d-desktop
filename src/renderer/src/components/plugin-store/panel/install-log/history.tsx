// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { useI18n } from '../../../../i18n/context'
import cx from '../../../../utils/cx'
import type { PluginHistoryEntry } from '../../state'
import { InstallLogModal } from './log-modal'

export function HistoryZone({ history, pluginName }: {
  history: PluginHistoryEntry[]
  pluginName: string
}) {
  const { t } = useI18n()
  const [selectedLog, setSelectedLog] = useState<InstallLog | null>(null)
  const reversed = [...history].reverse()

  return (
    <div className="install-zone history">
      <div className="history-events">
        {reversed.map((entry, entryIndex) => (
          <div key={entryIndex} className={cx('history-event', entry.action, entry.log?.ok === false && 'fail')}>
            <span className="history-event-label">
              {entry.action === 'install' ? t('history.event.installed') : t('history.event.uninstalled')}
            </span>
            <span className="history-event-time">{new Date(entry.timestamp).toLocaleString()}</span>
            {entry.log && (
              <button className="install-zone-link" onClick={() => setSelectedLog(entry.log!)}>
                {t('install.zone.view')}
              </button>
            )}
          </div>
        ))}
      </div>
      {selectedLog && (
        <InstallLogModal log={selectedLog} pluginName={pluginName} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  )
}
