// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TFunction } from '../../../../i18n'
import { useI18n } from '../../../../i18n/context'
import { IconCopy, IconExternalLink } from '../../../../design-system/icons'
import { Button } from '../../../common/Button'
import { useClipboard } from '../../../common/hooks/useClipboard'

function isUrl(value: string): boolean {
  return /^https?:\/\//.test(value)
}

function CaptureRow({ value, t }: { value: string; t: TFunction }) {
  const { copied, copy } = useClipboard()

  return (
    <div className="capture-row">
      <code className="capture-value">{value}</code>
      <div className="capture-actions">
        <Button variant="outline" size="sm" onClick={() => copy(value)}>
          <IconCopy size={12} />{copied ? t('store.captured_copied') : t('store.captured_copy')}
        </Button>
        {isUrl(value) && (
          <Button variant="outline" size="sm" onClick={() => window.b3d.openUrl(value)}>
            <IconExternalLink size={12} />{t('store.captured_open')}
          </Button>
        )}
      </div>
    </div>
  )
}

// Captured strings (URLs/regex matches the plugin's service logged), newest first so the most recent
// one-time link is on top. Values are unique (deduped in main), so each is its own stable key.
export function CapturesView({ captures }: { captures: string[] }) {
  const { t } = useI18n()
  if (captures.length === 0) {
    return (
      <div className="panel-body">
        <p className="panel-doc-empty">{t('store.captured_empty')}</p>
      </div>
    )
  }

  return (
    <div className="panel-body capture-list">
      {[...captures].reverse().map((value) => <CaptureRow key={value} value={value} t={t} />)}
    </div>
  )
}
