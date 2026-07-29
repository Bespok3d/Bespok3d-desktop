// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { BUNDLED_ADAPTERS } from '../../data/catalog/bundled'
import './add-printer.css'

interface AdapterSelectProps {
  adapterId: string
  onChange: (adapterId: string) => void
}

export function AdapterSelect({ adapterId, onChange }: AdapterSelectProps) {
  return (
    <>
      <select
        className="ap-select u-w-full"
        value={adapterId}
        onChange={(event) => onChange(event.target.value)}
      >
        {BUNDLED_ADAPTERS.map((adapter) => (
          <option key={adapter.id} value={adapter.id}>
            {adapter.title} · {adapter.vendor}
          </option>
        ))}
      </select>
      <div className="u-hint u-mt-1">
        {BUNDLED_ADAPTERS.find((adapter) => adapter.id === adapterId)?.description}
      </div>
    </>
  )
}
