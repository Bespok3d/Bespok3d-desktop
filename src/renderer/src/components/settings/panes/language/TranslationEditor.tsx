import { useState } from 'react'
import { useI18n } from '../../../../i18n/context'
import { Modal } from '../../../common/overlay/Modal'
import { Button } from '../../../common/Button'
import { LOCALES, LOCALE_DATA } from '../../../../i18n'
import { IconClose, IconDownload } from '../../../../design-system/icons'
import { downloadJson } from '../../../../utils/download'

const GROUP_LABELS: Record<string, string> = {
  header: 'Header', filter: 'Filters', trust: 'Trust',
  cat: 'Categories', status: 'Status', btn: 'Buttons', set: 'Settings',
}

function groupByNamespace(keys: string[]): Record<string, string[]> {
  return keys.reduce<Record<string, string[]>>((acc, key) => {
    const ns = key.split('.')[0]

    return { ...acc, [ns]: [...(acc[ns] ?? []), key] }
  }, {})
}

function TranslationRow({ enKey, enStr, value, onChange }: {
  enKey: string; enStr: string; value: string
  onChange: (val: string) => void
}) {
  return (
    <div className="translation-row">
      <div className="translation-ref">
        <div className="translation-key mono">{enKey}</div>
        <div className="translation-str">{enStr}</div>
      </div>
      <input
        className="translation-input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={enStr}
      />
    </div>
  )
}

function TranslationGroup({ namespace, keys, enDict, edits, onChange }: {
  namespace: string; keys: string[]
  enDict: Record<string, string>; edits: Record<string, string>
  onChange: (key: string, val: string) => void
}) {
  return (
    <div className="translation-group">
      <div className="translation-group-label">{GROUP_LABELS[namespace] ?? namespace}</div>
      {keys.map((key) => (
        <TranslationRow
          key={key}
          enKey={key}
          enStr={enDict[key] ?? key}
          value={edits[key] ?? ''}
          onChange={(val) => onChange(key, val)}
        />
      ))}
    </div>
  )
}

export function TranslationEditor({ code, onClose }: { code: string; onClose: () => void }) {
  const { t, customLocales, setCustomTranslations } = useI18n()
  const locale = LOCALES.find((loc) => loc.code === code)
  const builtIn = LOCALE_DATA[code] ?? {}
  const [edits, setEdits] = useState<Record<string, string>>(() => ({
    ...builtIn,
    ...(customLocales[code] ?? {}),
  }))

  function handleChange(key: string, val: string) {
    setEdits((prev) => ({ ...prev, [key]: val }))
  }

  function handleSave() {
    const cleaned = Object.fromEntries(Object.entries(edits).filter(([, val]) => val.trim() !== ''))
    setCustomTranslations(code, cleaned)
    onClose()
  }

  const enDict = LOCALE_DATA['en']
  const groups = groupByNamespace(Object.keys(enDict))

  return (
    <Modal onClose={onClose} surfaceClassName="translation-editor">
      <div className="translation-editor-header">
        <span className="translation-editor-title">{t('lang.editor.title', { name: locale?.nativeName ?? code })}</span>
        <button className="settings-close" onClick={onClose}><IconClose size={14} /></button>
      </div>
      <div className="translation-editor-body">
        {Object.entries(groups).map(([ns, keys]) => (
          <TranslationGroup
            key={ns} namespace={ns} keys={keys}
            enDict={enDict} edits={edits} onChange={handleChange}
          />
        ))}
      </div>
      <div className="translation-editor-footer">
        <Button variant="ghost" size="sm" onClick={() => downloadJson(`${code}.json`, edits)}>
          <IconDownload size={13} /> {t('lang.editor.download')}
        </Button>
        <div className="u-flex-1" />
        <Button variant="ghost" size="sm" onClick={onClose}>{t('btn.cancel')}</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>{t('btn.save')}</Button>
      </div>
    </Modal>
  )
}
