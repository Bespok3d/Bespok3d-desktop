import { useI18n } from '../../../i18n/context'
import { SettingRow } from '../../common/SettingRow'
import { Segmented } from '../../common/Segmented'
import { Button } from '../../common/Button'
import { FieldInput } from '../../plugin-store/config/config-form'
import type { PluginConfigField } from '../../../data/types'
import {
  localScopeKey,
  resolveFieldValue,
  saveFieldValue,
  clearFieldScope,
  clearAllPrinterScopes,
} from '../../../data/plugin-vars'
import type { DefaultsEntry, ScopedDefaultsStore } from './defaults-entries'

function SharedValueControls({ sharedValue, onOverride }: { sharedValue: string; onOverride: () => void }) {
  const { t } = useI18n()

  return (
    <>
      <span className="defaults-shared-value">{sharedValue || t('store.config_unset')}</span>
      <Button variant="outline" size="sm" onClick={onOverride}>{t('gen.defaults_override')}</Button>
    </>
  )
}

function OverrideControls({ field, value, onChange, onClear }: {
  field: PluginConfigField; value: string; onChange: (next: string) => void; onClear: () => void
}) {
  const { t } = useI18n()

  return (
    <>
      <FieldInput field={field} value={value} onChange={onChange} />
      <Button variant="outline" size="sm" onClick={onClear}>{t('gen.defaults_use_shared')}</Button>
    </>
  )
}

// The VARIABLE-level scope switch: flipping to "All printers" drops EVERY printer's own value so
// the field moves back to the shared view (a variable never has a mixed scope). A manifest hint of
// 'printer' keeps the field per-printer, so that direction is disabled and the row hint says why.
function VariableScopeSwitch({ entry, store }: { entry: DefaultsEntry; store: ScopedDefaultsStore }) {
  const { t } = useI18n()

  return (
    <Segmented
      value="printer"
      options={[
        { value: 'global', label: t('store.scope_all_printers'), disabled: entry.field.scope === 'printer' },
        { value: 'printer', label: t('store.scope_this_printer') },
      ]}
      onChange={(choice) => {
        if (choice === 'global') store.onScopedVarsChange(clearAllPrinterScopes(store.scopedVars, entry.field.key))
      }}
    />
  )
}

// Pick-edit-clear for one field on the chosen printer: without an override the row shows the shared
// value it inherits plus a way to take its own; with one, the override edits live and clears back to
// the shared value (clearing deletes the entry, so presence keeps meaning "overridden"). The scope
// switch at the end acts on the variable itself, for every printer at once.
export function PrinterDefaultRow({ entry, label, printerKey, store }: {
  entry: DefaultsEntry; label: string; printerKey: string; store: ScopedDefaultsStore
}) {
  const { t } = useI18n()
  const overrideScopeKey = localScopeKey(printerKey)
  const overrideValue = store.scopedVars[entry.field.key]?.[overrideScopeKey]
  const sharedValue = resolveFieldValue(store.scopedVars, undefined, entry.field)
  const stateHint = t(overrideValue === undefined ? 'gen.defaults_shared_value' : 'gen.defaults_own_value')
  const hint = entry.field.scope === 'printer' ? `${stateHint} ${t('gen.defaults_hint_locked')}` : stateHint
  const valueControls = overrideValue === undefined
    ? (
      <SharedValueControls
        sharedValue={sharedValue}
        onOverride={() => store.onScopedVarsChange(saveFieldValue(store.scopedVars, overrideScopeKey, entry.field.key, sharedValue))}
      />
    )
    : (
      <OverrideControls
        field={entry.field}
        value={overrideValue}
        onChange={(value) => store.onScopedVarsChange(saveFieldValue(store.scopedVars, overrideScopeKey, entry.field.key, value))}
        onClear={() => store.onScopedVarsChange(clearFieldScope(store.scopedVars, overrideScopeKey, entry.field.key))}
      />
    )

  return (
    <SettingRow
      className="defaults-scope-row"
      label={label}
      hint={hint}
      controls={<>{valueControls}<VariableScopeSwitch entry={entry} store={store} /></>}
    />
  )
}
