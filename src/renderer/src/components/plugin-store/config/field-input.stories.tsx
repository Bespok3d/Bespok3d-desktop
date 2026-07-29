// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { FieldInput } from './field-input'
import type { PluginConfigField } from '../../../data/types'
import '../plugin-store.css'

export default { title: 'Store / Config FieldInput' }

// The config-editor input control, rendered for each field type the plugin config schema supports.
function Field({ field }: { field: PluginConfigField }) {
  const [value, setValue] = useState(field.default ?? '')

  return (
    <div className="config-field">
      <label>{field.label}</label>
      <FieldInput field={field} value={value} onChange={setValue} />
    </div>
  )
}

export function TextField() {
  return <Field field={{ key: 'server', label: 'Server address', type: 'text', scope: 'global', placeholder: '192.168.1.50:8000' }} />
}

export function NumberField() {
  return <Field field={{ key: 'port', label: 'Port', type: 'number', scope: 'global', placeholder: '80' }} />
}

export function SelectField() {
  return <Field field={{ key: 'mode', label: 'Selection mode', type: 'select', scope: 'global', options: ['auto', 'manual'], default: 'auto' }} />
}

export function ToggleField() {
  return <Field field={{ key: 'logging', label: 'Verbose logging', type: 'toggle', scope: 'global', onValue: 'on', offValue: 'off' }} />
}
