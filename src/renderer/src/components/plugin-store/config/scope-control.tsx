import type { PluginConfigField } from '../../../data/types'
import type { ScopeChoice } from '../../../data/plugin-vars'
import { useI18n } from '../../../i18n/context'
import { Segmented } from '../../common/Segmented'

// The per-field scope choice: shared across the fleet, or this printer's own value. Always visible
// wherever scope applies (a control that appears and disappears reads as a bug); a choice that
// cannot be made right now is DISABLED via disabledChoice and explained by the caller (a section
// note or the `note` prop). The flip microcopy appears when the choice differs from the manifest
// hint, saying what the next save will do with the value. Shared by the detail panel's config
// rows, the batch capture, and the Settings defaults pane.
export function ScopeControl({ field, scope, onScopeChange, disabledChoice, note }: {
  field: PluginConfigField
  scope: ScopeChoice
  onScopeChange: (fieldKey: string, choice: ScopeChoice) => void
  disabledChoice?: ScopeChoice
  note?: string
}) {
  const { t } = useI18n()

  return (
    <div className="config-scope">
      <Segmented
        value={scope}
        options={[
          { value: 'global', label: t('store.scope_all_printers'), disabled: disabledChoice === 'global' },
          { value: 'printer', label: t('store.scope_this_printer'), disabled: disabledChoice === 'printer' },
        ]}
        onChange={(choice) => onScopeChange(field.key, choice)}
      />
      {scope !== field.scope && (
        <span className="config-scope-note">
          {t(scope === 'printer' ? 'store.scope_note_printer' : 'store.scope_note_global')}
        </span>
      )}
      {note && <span className="config-scope-note">{note}</span>}
    </div>
  )
}
