import { useState } from 'react'
import { useI18n } from '../../../../i18n/context'
import cx from '../../../../utils/cx'
import { IconCheckCircle, IconAlert } from '../../../../design-system/icons'
import { InstallLogModal } from './log-modal'

export function InstallZone({ phase, stepLabel, log, pluginName, onOpenLive }: {
  phase: 'idle' | 'working' | 'error'
  stepLabel: string
  log: InstallLog | null
  pluginName: string
  onOpenLive?: () => void
}) {
  const { t } = useI18n()
  const [modalOpen, setModalOpen] = useState(false)

  if (phase === 'working') return (
    <button className="install-zone working" onClick={onOpenLive}>
      <div className="install-zone-working-row">
        <div className="au-spinner install-zone-spinner" />
        <span className="install-zone-label">{stepLabel || t('install.zone.working')}</span>
        <span className="install-zone-link">{t('install.zone.view')}</span>
      </div>
      <div className="install-progress-indet"><div className="install-progress-indet-bar" /></div>
    </button>
  )

  if (!log) return null

  const totalItems = log.phases.reduce((acc, logPhase) => acc + logPhase.items.length, 0)
  const zoneState = log.ok ? 'done' : 'fail'

  return (
    <>
      <button
        className={cx('install-zone', zoneState)}
        onClick={() => setModalOpen(true)}
      >
        {log.ok
          ? <IconCheckCircle size={13} />
          : <IconAlert size={13} />
        }
        <span className="install-zone-label">
          {log.ok
            ? t('install.zone.done', { steps: totalItems })
            : t('install.zone.failed')
          }
        </span>
        <span className="install-zone-link">{t('install.zone.view')}</span>
      </button>
      {modalOpen && (
        <InstallLogModal log={log} pluginName={pluginName} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
