// The truth ladder for an installed plugin's Config tab (design point 7 of the plugin-config-scope
// relay): show only values someone can vouch for, most authoritative first.
//   tier 'live'    = the daemon's persisted user_vars.json, read moments ago; shown unbadged.
//   tier 'applied' = what THIS computer last sent, with a visible "as sent on [date]" marker
//                    (another computer may have reconfigured since).
//   tier 'unknown' = no source can vouch for anything: every field shows an explicit placeholder,
//                    never a global default that may not match the printer.
// This replaces the old display of the app-global saved-vars map, which showed whatever this
// computer would SEND NEXT rather than what the printer actually runs.

export type ConfigTruthTier = 'live' | 'applied' | 'unknown'

export interface ConfigTruth {
  tier: ConfigTruthTier
  values: Record<string, string>
  appliedAt?: string
}

export function configTruth(
  liveVars: Record<string, string> | null,
  appliedVars: Record<string, string> | undefined,
  appliedAt: string | undefined,
): ConfigTruth {
  if (liveVars) return { tier: 'live', values: liveVars }
  if (appliedVars) return { tier: 'applied', values: appliedVars, appliedAt }

  return { tier: 'unknown', values: {} }
}
