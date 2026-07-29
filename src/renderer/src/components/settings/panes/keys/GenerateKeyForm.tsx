// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { IconKey } from '../../../../design-system/icons'
import { Button } from '../../../common/Button'
import { useAsyncAction } from '../../../common/hooks/useAsyncAction'
import { useI18n } from '../../../../i18n/context'
import './keys.css'

interface GenerateKeyFormProps {
  onGenerate: (label: string) => Promise<void>
}

export function GenerateKeyForm({ onGenerate }: GenerateKeyFormProps) {
  const { t } = useI18n()
  const [label, setLabel] = useState('')
  const { busy, error, run } = useAsyncAction(async () => {
    await onGenerate(label.trim())
    setLabel('')
  })

  function generate() {
    if (label.trim()) void run()
  }

  return (
    <div className="key-gen-form">
      <div className="u-row u-gap-2">
        <input
          type="text"
          className="set-text u-flex-1"
          placeholder={t('keys.gen.placeholder')}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && generate()}
          disabled={busy}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={generate}
          disabled={!label.trim() || busy}
          className="u-shrink-0"
        >
          <IconKey size={13} />
          &nbsp;{busy ? t('keys.gen.generating') : t('keys.gen.generate')}
        </Button>
      </div>
      {error && (
        <div className="key-gen-error">
          {error}
        </div>
      )}
    </div>
  )
}
