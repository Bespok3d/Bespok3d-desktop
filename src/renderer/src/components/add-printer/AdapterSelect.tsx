// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import './add-printer.css'

interface AdapterSelectProps {
  // The adapters this build actually registered, read over IPC by the form. Offering anything else
  // would let someone pick an adapter enrollment then fails to find.
  adapters: AdapterInfo[]
  adapterId: string
  onChange: (adapterId: string) => void
}

export function AdapterSelect({ adapters, adapterId, onChange }: AdapterSelectProps) {
  return (
    <>
      <select
        className="ap-select u-w-full"
        value={adapterId}
        onChange={(event) => onChange(event.target.value)}
      >
        {adapters.map((adapter) => (
          <option key={adapter.id} value={adapter.id}>
            {adapter.title} · {adapter.vendor}
          </option>
        ))}
      </select>
      <div className="u-hint u-mt-1">
        {adapters.find((adapter) => adapter.id === adapterId)?.description}
      </div>
    </>
  )
}
