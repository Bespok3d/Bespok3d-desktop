// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { Plugin } from '../../../data/types'
import type { ScopeChoice } from '../../../data/plugin-vars'
import { useI18n } from '../../../i18n/context'
import { Button } from '../../common/Button'
import { Modal } from '../../common/overlay/Modal'
import { FieldInput, ScopeControl, configComplete } from '../config/config-form'
import { initialBatchValues } from './batch-install'

// One selected plugin's config fields on the batch-capture screen. Reuses the same FieldInput (and,
// when scope choices are threaded, the same ScopeControl) the per-plugin panel uses, so a field
// renders identically here and there.
function PluginConfigGroup({ plugin, values, scopes, onField, onScopeChange }: {
  plugin: Plugin
  values: Record<string, string>
  scopes?: Record<string, ScopeChoice>
  onField: (key: string, value: string) => void
  onScopeChange?: (fieldKey: string, choice: ScopeChoice) => void
}) {
  return (
    <div className="batch-config-group">
      <div className="batch-config-plugin">{plugin.title}</div>
      <div className="config-fields">
        {(plugin.config ?? []).map((field) => (
          <div key={field.key} className="config-field">
            <label>{field.label}{field.required && <span className="config-req" aria-hidden>*</span>}</label>
            <FieldInput field={field} value={values[field.key] ?? ''} onChange={(next) => onField(field.key, next)} />
            {scopes && onScopeChange && (
              <ScopeControl field={field} scope={scopes[field.key] ?? field.scope} onScopeChange={onScopeChange} />
            )}
            {field.hint && <span className="config-hint">{field.hint}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// Collect the values the selected plugins need before a batch install. Install stays disabled until
// every required field across the set has a value, so the batch never installs a half-configured plugin.
// The per-field scope control (All printers / This printer) renders when the flow threads scope
// choices (both production flows do); the choices stay flow-state until the capture is confirmed,
// so a cancelled batch saves nothing, values and scopes alike.
export function BatchConfigModal({ plugins, savedVars, busy, scopes, onScopeChange, onCancel, onConfirm }: {
  plugins: Plugin[]
  savedVars: Record<string, string>
  busy: boolean
  scopes?: Record<string, ScopeChoice>
  onScopeChange?: (fieldKey: string, choice: ScopeChoice) => void
  onCancel: () => void
  onConfirm: (captured: Record<string, string>) => void
}) {
  const { t } = useI18n()
  const [values, setValues] = useState(() => initialBatchValues(plugins, savedVars))
  const ready = plugins.every((plugin) => configComplete(plugin.config ?? [], values))

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Modal onClose={onCancel} className="batch-config-modal">
      <div className="modal-head">
        <h2>{t('batch_config.title')}</h2>
        <p>{t('batch_config.body')}</p>
      </div>
      <div className="batch-config-scroll">
        {plugins.map((plugin) => (
          <PluginConfigGroup key={plugin.id} plugin={plugin} values={values} scopes={scopes} onField={setField} onScopeChange={onScopeChange} />
        ))}
      </div>
      <div className="batch-config-foot">
        <Button variant="outline" onClick={onCancel} disabled={busy}>{t('btn.cancel')}</Button>
        <Button variant="primary" onClick={() => onConfirm(values)} disabled={!ready || busy}>
          {t('batch_config.install', { count: plugins.length })}
        </Button>
      </div>
    </Modal>
  )
}
