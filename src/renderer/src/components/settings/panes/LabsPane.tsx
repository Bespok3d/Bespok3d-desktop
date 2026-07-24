import { useState, useEffect } from 'react'
import { Group } from '../../common/Group'
import { Segmented } from '../../common/Segmented'
import { SettingRow } from '../../common/SettingRow'
import { useI18n } from '../../../i18n/context'

type WorkbenchLayout = 'A' | 'B'

function LayoutChoice({ value, onChange }: { value: WorkbenchLayout; onChange: (next: WorkbenchLayout) => void }) {
  const { t } = useI18n()
  const options: { value: WorkbenchLayout; label: string }[] = [
    { value: 'A', label: t('labs.layout_a') },
    { value: 'B', label: t('labs.layout_b') },
  ]

  return <Segmented value={value} options={options} onChange={onChange} />
}

export function LabsPane() {
  const { t } = useI18n()
  const [layout, setLayout] = useState<WorkbenchLayout>('A')

  function loadLayout() {
    window.b3d.settings.get().then((settings) => setLayout(settings.workbenchLayout))
  }
  useEffect(loadLayout, [])

  function change(next: WorkbenchLayout) {
    setLayout(next)
    window.b3d.settings.set({ workbenchLayout: next })
  }

  return (
    <>
      <div className="set-pane-intro">{t('labs.intro')}</div>
      <Group title={t('labs.workbench_layout')}>
        <SettingRow label={t('labs.layout_label')} hint={t('labs.layout_hint')} controls={<LayoutChoice value={layout} onChange={change} />} />
      </Group>
    </>
  )
}
