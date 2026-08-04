// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginConfigField } from '../../../data/types'
import { Toggle } from '../../common/Toggle'
import { AddressField } from './address-field'
import { UrlField } from './url-field'

export function FieldInput({ field, value, onChange }: {
  field: PluginConfigField; value: string; onChange: (next: string) => void
}) {
  if (field.type === 'toggle') {
    const onValue = field.onValue ?? 'true'

    return <Toggle on={value === onValue} onChange={(next) => onChange(next ? onValue : (field.offValue ?? 'false'))} />
  }
  if (field.type === 'select') {
    return (
      <select className="config-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    )
  }
  if (field.type === 'address') return <AddressField field={field} value={value} onChange={onChange} />
  if (field.type === 'url') return <UrlField field={field} value={value} onChange={onChange} />
  const numeric = field.type === 'number' || field.type === 'http-port'

  return (
    <input
      className="config-input"
      type={numeric ? 'number' : 'text'}
      placeholder={field.placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
