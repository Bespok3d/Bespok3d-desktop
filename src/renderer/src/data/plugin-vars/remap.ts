import { localScopeKey, type ScopedPluginVars } from './types'

function remapFieldScopes(
  fieldScopes: Record<string, string>,
  recordScopeKey: string,
  uuidScopeKey: string,
): Record<string, string> {
  if (fieldScopes[recordScopeKey] === undefined) return fieldScopes
  const { [recordScopeKey]: recordValue, ...remainingScopes } = fieldScopes

  return { ...remainingScopes, [uuidScopeKey]: remainingScopes[uuidScopeKey] ?? recordValue }
}

// One-shot move of a printer's per-printer values from its app-local record id onto the daemon-held
// printer UUID, the first time the UUID is learned. A value already saved under the UUID wins a
// collision: it can only exist if it was written after the UUID was known, so it is the newer intent.
// When nothing moves, the INPUT reference is returned, so a caller re-running the remap on every
// printers change (the App effect) converges instead of looping on a fresh identical object.
export function remapPrinterScope(
  scopedVars: ScopedPluginVars,
  appRecordId: string,
  printerUuid: string,
): ScopedPluginVars {
  const recordScopeKey = localScopeKey(appRecordId)
  const uuidScopeKey = localScopeKey(printerUuid)
  const remappedEntries = Object.entries(scopedVars).map(([fieldKey, fieldScopes]): [string, Record<string, string>] => [
    fieldKey,
    remapFieldScopes(fieldScopes, recordScopeKey, uuidScopeKey),
  ])
  const anyMoved = remappedEntries.some(([fieldKey, fieldScopes]) => fieldScopes !== scopedVars[fieldKey])

  return anyMoved ? Object.fromEntries(remappedEntries) : scopedVars
}
