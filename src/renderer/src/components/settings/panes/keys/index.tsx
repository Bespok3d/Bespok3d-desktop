import { useState } from 'react'
import { IconPlus } from '../../../../design-system/icons'
import { Group } from '../../../common/Group'
import { Button } from '../../../common/Button'
import type { KeyRecord } from '../../../../data/keyTypes'
import type { KeyHandlers } from './key-handlers'
import { KeyRow } from './KeyRow'
import { GenerateKeyForm } from './GenerateKeyForm'
import { useI18n } from '../../../../i18n/context'

export interface KeysPaneProps extends KeyHandlers {
  keys: KeyRecord[]
  onGenerate: (label: string) => Promise<void>
}

export function KeysPane({
  keys,
  printers,
  gitHostSettings,
  allUserRepos,
  onGenerate,
  onRemove,
  onSetDefault,
  onSetAssignments,
  onSetIcon,
  onSetPublishedAt,
}: KeysPaneProps) {
  const { t } = useI18n()
  const [showForm, setShowForm] = useState(false)
  const hasKeys = keys.length > 0

  return (
    <>
      <div className="set-pane-intro">{t('keys.intro')}</div>

      <Group
        title={t('keys.my_keys')}
        action={
          <Button variant="outline" size="sm" onClick={() => setShowForm((prev) => !prev)}>
            <IconPlus size={13} /> {t('keys.generate_new')}
          </Button>
        }
      >
        {!hasKeys && !showForm && (
          <div className="set-empty">{t('keys.empty')}</div>
        )}

        {keys.map((key) => (
          <KeyRow
            key={key.id}
            keyRecord={key}
            printers={printers}
            gitHostSettings={gitHostSettings}
            allUserRepos={allUserRepos}
            onRemove={onRemove}
            onSetDefault={onSetDefault}
            onSetAssignments={onSetAssignments}
            onSetIcon={onSetIcon}
            onSetPublishedAt={onSetPublishedAt}
          />
        ))}

        {(!hasKeys || showForm) && <GenerateKeyForm onGenerate={onGenerate} />}
      </Group>
    </>
  )
}
