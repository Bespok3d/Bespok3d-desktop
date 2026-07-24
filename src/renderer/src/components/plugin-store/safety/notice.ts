export interface SafetyNotice {
  pluginId: string
  // The plain-words fact of what the safety net did + why (no "fix it yourself" advice; that is the
  // app's job to phrase per user tier).
  detail: string
  // The captured Klipper/Moonraker log tail, for the technical tier + the bug report.
  log: string
}

// The daemon appends an "auto-recovery" phase to the install log when a safety fixer deactivated a
// plugin to keep a core service alive. We surface that as a popup so the user is never left believing
// an install succeeded when it was actually disabled to save the printer.
export function autoRecoveryNotice(log: InstallLog | undefined): SafetyNotice | null {
  if (!log) return null
  const phase = log.phases.find((candidate: InstallLogPhase) => candidate.id === 'auto-recovery')
  const first = phase?.items[0]
  if (!first) return null

  return { pluginId: log.pluginId, detail: first.label, log: first.output }
}
