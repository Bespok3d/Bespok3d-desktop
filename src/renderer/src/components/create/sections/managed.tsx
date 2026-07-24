import { useI18n } from '../../../i18n/context'
import { IconShieldCheck } from '../../../design-system/icons'
import { Toggle } from '../../common/Toggle'
import { DRAFT_MANAGED, AUTHORING_OPS } from '../create-data'
import { OpChip } from './op-chip'
import { SecHead } from './sec-head'

function ManagedRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-row-label">{label}</div>
        <div className="set-row-hint">{hint}</div>
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  )
}

export function ManagedSection() {
  const { t } = useI18n()

  return (
    <div className="wb-sec">
      <SecHead icon="IconServer" title={t('create.sec.managed_title')} tier="nerd"
        blurb={t('create.sec.managed_blurb')} />
      <div className="set-group">
        <ManagedRow label={t('create.sec.command')} hint={t('create.sec.command_hint')}>
          <span className="val mono">{DRAFT_MANAGED.command}</span>
        </ManagedRow>
        <ManagedRow label={t('create.sec.start_auto')} hint={t('create.sec.start_auto_hint')}>
          <Toggle on={DRAFT_MANAGED.autostart} disabled onChange={() => {}} />
        </ManagedRow>
        <ManagedRow label={t('create.sec.port')} hint={t('create.sec.port_hint')}>
          <span className="val mono">{DRAFT_MANAGED.port}</span>
        </ManagedRow>
        <ManagedRow label={t('create.sec.python_env')} hint={t('create.sec.python_env_hint')}>
          <span className="val mono">{DRAFT_MANAGED.venv}</span>
        </ManagedRow>
      </div>
      <div className="wb-genwarn">
        <IconShieldCheck size={14} />
        <span>{t('create.sec.managed_warn')}</span>
      </div>
      <OpChip op={AUTHORING_OPS.declareManaged} />
    </div>
  )
}
