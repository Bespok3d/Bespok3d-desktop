import { useState } from 'react'
import type { PluginConfigField } from '../../../data/types'
import type { ScopeChoice, ScopeFlipHandler } from '../../../data/plugin-vars'
import { PRIMARY_PORT } from '../../../data/ports/allocator'
import { httpPortError } from '../../../data/ports'
import { useI18n } from '../../../i18n/context'
import { formatDateTime } from '../../../utils/datetime'
import { Button } from '../../common/Button'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { FieldInput } from './field-input'
import { ScopeControl } from './scope-control'
import { initialConfigValues } from './values'
import type { ConfigTruthTier } from './config-truth'

function MakePrimaryButton({ value, onMakePrimary }: { value: string; onMakePrimary?: () => void }) {
  const { t } = useI18n()
  if (!onMakePrimary) return null

  return (
    <Button
      variant="outline"
      size="sm"
      className="config-make-primary"
      disabled={Number(value) === PRIMARY_PORT}
      onClick={onMakePrimary}
    >
      {t('store.make_primary')}
    </Button>
  )
}

function ConfigRow({ field, value, emptyLabel, editing, scope, scopeDisabledChoice, onEdit, onChange, onScopeChange, onMakePrimary }: {
  field: PluginConfigField; value: string; emptyLabel: string; editing: boolean
  scope?: ScopeChoice; scopeDisabledChoice?: ScopeChoice
  onEdit: () => void; onChange: (next: string) => void
  onScopeChange?: ScopeFlipHandler; onMakePrimary?: () => void
}) {
  const canEdit = field.userEditable !== false
  const isPort = field.type === 'http-port'

  return (
    <div className="config-field">
      <label>{field.label}</label>
      {editing && canEdit
        ? <FieldInput field={field} value={value} onChange={onChange} />
        : (
          <button className="config-value" disabled={!canEdit} onClick={onEdit}>
            {value || emptyLabel}
          </button>
        )}
      {isPort && editing && canEdit && <MakePrimaryButton value={value} onMakePrimary={onMakePrimary} />}
      {editing && canEdit && scope && onScopeChange && (
        <ScopeControl field={field} scope={scope} disabledChoice={scopeDisabledChoice} onScopeChange={(fieldKey, choice) => onScopeChange(fieldKey, choice, value)} />
      )}
      {field.hint && <span className="config-hint">{field.hint}</span>}
    </div>
  )
}

// One line explaining the scope control's current reach, so it never just greys out or acts on a
// preference without saying so: no printer selected = per-printer choices need one; printer
// selected but offline = changes are preferences until the printer can be reached.
function ScopeContextNote({ printerSelected, printerConnected }: { printerSelected: boolean; printerConnected: boolean }) {
  const { t } = useI18n()
  if (!printerSelected) return <p className="config-truth-note">{t('store.scope_note_select_printer')}</p>
  if (!printerConnected) return <p className="config-truth-note">{t('store.config_offline_note')}</p>

  return null
}

// The provenance line under the truth-ladder values: tier 'applied' marks the values as this
// computer's last send (they may be outdated), tier 'unknown' says outright that nothing could be
// read. Tier 'live' (and the pre-install form) needs no caveat.
function TruthMarker({ tier, appliedAt }: { tier?: ConfigTruthTier; appliedAt?: string }) {
  const { t } = useI18n()
  if (tier === 'applied') {
    return <p className="config-truth-note">{t('store.config_applied_marker', { date: appliedAt ? formatDateTime(appliedAt) : '?' })}</p>
  }
  if (tier === 'unknown') return <p className="config-truth-note">{t('store.config_unknown_note')}</p>

  return null
}

export function PluginConfigSection({ fields, current, tier, appliedAt, installed, printerId, printerSelected, pluginId, scopes, onScopeChange, otherUiPorts, onValuesChange, onApplied, onMakePrimary }: {
  fields: PluginConfigField[]
  current: Record<string, string>
  // Truth-ladder provenance of `current` for an installed plugin; undefined on the pre-install form.
  tier?: ConfigTruthTier
  appliedAt?: string
  installed: boolean
  // The MANAGED printer handle (live daemon ops: reconfigure). Absent when the printer is offline.
  printerId?: string
  // Whether any printer is behind the panel, whatever its status: scope choices bind to it via the
  // App-bound save path even while it is offline (they are preferences, not device writes).
  printerSelected?: boolean
  pluginId: string
  // Per-field scope choices (owned by the panel, so a completed install can persist them too). The
  // scope control renders whenever a change handler is threaded; with no printer selected the
  // "This printer" choice is disabled and the section note says why. A flip reports the field's
  // shown value along so the owner can persist it immediately.
  scopes?: Record<string, ScopeChoice>
  onScopeChange?: ScopeFlipHandler
  otherUiPorts?: number[]
  onValuesChange?: (values: Record<string, string>) => void
  onApplied?: (values: Record<string, string>, installedIds: string[]) => void
  onMakePrimary?: () => void
}) {
  const { t } = useI18n()
  // A managed handle implies a selected printer; the explicit prop only matters for the offline
  // case (selected but unreachable), so callers without that distinction stay correct.
  const printerInContext = printerSelected ?? printerId !== undefined
  // Drafts are proposals, so they seed complete: a field the truth cannot vouch for starts from its
  // default (same as a fresh install form) rather than an unsendable hole in the payload.
  const [draft, setDraft] = useState(() => initialConfigValues(fields, current))
  const [editing, setEditing] = useState(!installed)
  const dirty = fields.some((field) => draft[field.key] !== current[field.key])
  const portError = httpPortError(fields, editing ? draft : current, otherUiPorts ?? [])
  const emptyLabel = tier === 'unknown' ? t('store.config_unknown') : t('store.config_unset')
  const { busy: applying, error: applyError, run: apply } = useAsyncAction(async () => {
    if (!printerId) return
    const result = await window.b3d.store.reconfigure(printerId, pluginId, draft)
    onApplied?.(draft, result.installedIds)
    setEditing(false)
  })

  function setField(key: string, value: string) {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (!installed) onValuesChange?.(next)
  }
  function startEditing() {
    setDraft(initialConfigValues(fields, current))
    setEditing(true)
  }
  function cancel() {
    setDraft(initialConfigValues(fields, current))
    setEditing(false)
  }

  return (
    <div className="panel-config-section">
      <h3>{t('store.config_required')}</h3>
      {onScopeChange && <ScopeContextNote printerSelected={printerInContext} printerConnected={!!printerId} />}
      <div className="config-fields">
        {fields.map((field) => (
          <ConfigRow
            key={field.key}
            field={field}
            value={(editing ? draft : current)[field.key] ?? ''}
            emptyLabel={emptyLabel}
            editing={editing}
            scope={scopes?.[field.key] ?? field.scope}
            scopeDisabledChoice={printerInContext ? undefined : 'printer'}
            onEdit={startEditing}
            onChange={(next) => setField(field.key, next)}
            onScopeChange={onScopeChange}
            onMakePrimary={field.type === 'http-port' ? onMakePrimary : undefined}
          />
        ))}
      </div>
      {!editing && <TruthMarker tier={tier} appliedAt={appliedAt} />}
      {portError && editing && <p className="config-error">{portError}</p>}
      {applyError && editing && <p className="config-error">{applyError}</p>}
      {installed && editing && dirty && (
        <div className="config-actions">
          <Button variant="outline" onClick={cancel} disabled={applying}>{t('btn.cancel')}</Button>
          <Button variant="primary" onClick={apply} disabled={applying || !!portError || !printerId}>{t('store.update_config')}</Button>
        </div>
      )}
    </div>
  )
}
