// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The text box every address is typed into. It shows exactly what is in the field and hands back
// exactly what was typed; what an address means, and what happens when the field is left, belongs to
// the field that owns it.
export function AddressInput({ placeholder, value, onChange, onLeave }: {
  placeholder?: string; value: string; onChange: (next: string) => void; onLeave?: () => void
}) {
  return (
    <input
      className="config-input"
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onLeave}
    />
  )
}
