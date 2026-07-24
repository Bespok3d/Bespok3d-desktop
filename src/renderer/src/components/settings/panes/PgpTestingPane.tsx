import { useState, useEffect } from 'react'
import { Group } from '../../common/Group'
import { Toggle } from '../../common/Toggle'
import { Explainer } from '../../common/content/Explainer'
import { useI18n } from '../../../i18n/context'

function PgpSwitch() {
  const { t } = useI18n()
  const [on, setOn] = useState(false)
  useEffect(() => { window.b3d.settings.get().then((settings) => setOn(settings.pgpEnabled)) }, [])
  function toggle(next: boolean) { setOn(next); window.b3d.settings.set({ pgpEnabled: next }) }

  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-row-label">{t('pgp.switch_label')} {on ? t('pgp.on') : t('pgp.off')}</div>
        <div className="set-row-hint">{t('pgp.switch_hint')}</div>
      </div>
      <div className="set-row-control"><Toggle on={on} onChange={toggle} /></div>
    </div>
  )
}

export function PgpTestingPane() {
  const { t } = useI18n()

  return (
    <>
      <div className="set-pane-intro">{t('pgp.intro')}</div>
      <Group title={t('pgp.group_switch')}><PgpSwitch /></Group>
      <Group title={t('pgp.group_about')}>
        <div className="set-row"><Explainer brief={t('pgp.why_brief')} detail={t('pgp.why_detail')} /></div>
        <div className="set-row"><Explainer brief={t('pgp.system_brief')} detail={t('pgp.system_detail')} /></div>
        <div className="set-row"><Explainer brief={t('pgp.active_brief')} detail={t('pgp.active_detail')} /></div>
      </Group>
    </>
  )
}
