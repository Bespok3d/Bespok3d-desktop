// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'

// The value as it stands once it has stopped moving for `pauseMs`. Work that costs something (asking
// the network whether an address answers) hangs off this rather than off every keystroke, and it
// still lands while the person is looking at the field instead of waiting for them to leave it.
export function useSettledValue<T>(value: T, pauseMs: number): T {
  const [settled, setSettled] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), pauseMs)

    return () => clearTimeout(timer)
  }, [value, pauseMs])

  return settled
}
