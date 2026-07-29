// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { localScopeKey, type ScopedPluginVars } from './types'

function remapFieldScopes(
  fieldScopes: Record<string, string>,
  uuidScopeKey: string,
  recordScopeKey: string,
): Record<string, string> {
  if (fieldScopes[uuidScopeKey] === undefined) return fieldScopes
  const { [uuidScopeKey]: uuidValue, ...remainingScopes } = fieldScopes

  return { ...remainingScopes, [recordScopeKey]: remainingScopes[recordScopeKey] ?? uuidValue }
}

// Carries a printer's per-printer values off the daemon-held UUID an older build filed them under and
// onto the app's own record id, which is what survives the /userdata wipe, reflash or daemon
// reinstall that mints a fresh UUID. A value already saved under the record id wins a collision: it
// is the one this build has been writing. When nothing moves, the INPUT reference is returned, so a
// caller re-running the remap on every printers change (the App effect) converges instead of looping
// on a fresh identical object. This runs per printer, so entries never cross between two records.
export function remapPrinterScope(
  scopedVars: ScopedPluginVars,
  appRecordId: string,
  printerUuid: string,
): ScopedPluginVars {
  const recordScopeKey = localScopeKey(appRecordId)
  const uuidScopeKey = localScopeKey(printerUuid)
  const remappedEntries = Object.entries(scopedVars).map(([fieldKey, fieldScopes]): [string, Record<string, string>] => [
    fieldKey,
    remapFieldScopes(fieldScopes, uuidScopeKey, recordScopeKey),
  ])
  const anyMoved = remappedEntries.some(([fieldKey, fieldScopes]) => fieldScopes !== scopedVars[fieldKey])

  return anyMoved ? Object.fromEntries(remappedEntries) : scopedVars
}
