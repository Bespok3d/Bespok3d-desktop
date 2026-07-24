// What the app keeps about a plugin that did NOT install. Installing several plugins at once is the
// same thing as installing them one by one, so an attempt that failed leaves the same trace either
// way: the phases the printer got through, or the refusal that stopped the package from ever leaving
// this computer. The trace is kept until that plugin installs, so it outlives the modal that showed it.
import type { InstallLog, InstallLogPhase, PluginRecoveryResult } from '@bespok3d/contract'
import type { PrinterRecord } from '../printers'
import { PACKAGE_REFUSED_PREFIX } from './package-refused'

// The sentence to show the user for a package that was not sent. A refusal is already written for a
// human at the point it is thrown; the prefix in front of it is only there so the renderer can tell a
// refusal from a daemon failure, and it has no business in anything the user reads.
export function refusalSentence(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  return message.startsWith(PACKAGE_REFUSED_PREFIX) ? message.slice(PACKAGE_REFUSED_PREFIX.length) : message
}

// One plugin the app would not send, said in the same words the printer uses for a plugin it could not
// install, so a plugin refused on its own and the same plugin refused inside a batch are one shape.
export function refusedAttempt(pluginId: string, reason: string): PluginRecoveryResult {
  return { pluginId, ok: false, skipped: true, reason, log: [] }
}

// A plugin that was only waiting on another plugin did not install for its own sake: it never got its
// turn. Worded apart from a refusal on purpose, so the user can tell which plugin is the actual problem.
export function waitingOnDependencyReason(dependencyId: string | undefined): string {
  return `not installed because "${dependencyId}", which it needs, was not installed either`
}

// Thrown instead of the dependency's own error so the plugin that was waiting keeps "it never got its
// turn" while the dependency keeps the reason it was refused for. The message stays the dependency's,
// untouched, because that is what the user is shown as the install's failure.
export class DependencyDidNotInstall extends Error {
  readonly dependencyId: string

  constructor(dependencyId: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.dependencyId = dependencyId
  }
}

// Why THIS plugin did not install: the dependency it was waiting on, or its own refusal.
export function whyItDidNotInstall(failure: unknown): string {
  return failure instanceof DependencyDidNotInstall ? waitingOnDependencyReason(failure.dependencyId) : refusalSentence(failure)
}

// A package that never reached the printer has no phases to show, so the refusal itself becomes the
// one phase of the attempt: same shape as any install log, so whatever displays install logs displays
// this one too.
function refusalPhases(reason: string): InstallLogPhase[] {
  return [{ id: 'verify', label: 'Package check', ok: false, items: [{ label: 'Refused', ok: false, output: reason }] }]
}

function failedInstallLog(failure: PluginRecoveryResult, attemptedAt: number): InstallLog {
  return {
    pluginId: failure.pluginId,
    timestamp: attemptedAt,
    ok: false,
    phases: failure.log.length > 0 ? failure.log : refusalPhases(failure.reason),
  }
}

// The failed attempts the printer record carries after an operation: one per plugin that did not
// install, plus the earlier ones for plugins whose failure is still true. Only a plugin that installed
// HERE has nothing left to explain; the plugins already on the printer are not that, because a plugin
// whose UPDATE was just refused is installed and must still be able to say why the update did not land.
export function failedLogsAfter(
  record: PrinterRecord,
  failures: readonly PluginRecoveryResult[],
  justInstalledIds: readonly string[],
  attemptedAt: number,
): Record<string, InstallLog> {
  const earlier = Object.entries(record.failedInstallLogs ?? {}).filter(([pluginId]) => !justInstalledIds.includes(pluginId))
  const now = failures.map((failure) => [failure.pluginId, failedInstallLog(failure, attemptedAt)] as const)

  return { ...Object.fromEntries(earlier), ...Object.fromEntries(now) }
}
