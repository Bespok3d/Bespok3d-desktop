// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'
import type { PluginConfigField } from '../../../data/types'
import { initialConfigValues } from './values'

// The values the config form is editing, kept in front of whoever judges them. The detail panel reads
// them to decide whether the plugin can be installed or configured, so a field changed here and a
// cancel that puts the saved values back are both reported up as they happen: judging a value the user
// can no longer see is how the footer ends up asking for a protocol that is already on screen.
export function useReportedDraft(
  fields: PluginConfigField[],
  current: Record<string, string>,
  onValuesChange?: (values: Record<string, string>) => void,
) {
  const [draft, setDraft] = useState(() => initialConfigValues(fields, current))

  // Reported as soon as the values are on screen, not only when one is touched: an address that is
  // already right needs no touching, and until it is heard the panel keeps judging its own older copy.
  useEffect(() => {
    onValuesChange?.(draft)
  }, [draft])

  function setField(key: string, value: string) {
    setDraft({ ...draft, [key]: value })
  }
  function restoreSaved() {
    setDraft(initialConfigValues(fields, current))
  }

  return { draft, setField, restoreSaved }
}
