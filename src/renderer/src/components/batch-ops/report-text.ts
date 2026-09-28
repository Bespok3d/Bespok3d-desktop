// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The whole outcome of a batch, as text the user can paste into an issue. A batch that ends badly is
// never one plugin's story: which plugins went through, which were left behind, and what the printer
// said about each one is the answer, and none of it survives a screenshot of the modal.
import type { InstallLogItem, InstallLogPhase, PluginRecoveryResult } from '@bespok3d/contract'
import type { BatchResult, ManifestWarning } from '../../../../main/daemon-client/batch-result'

function appVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown'
}

function outcomeWord(result: PluginRecoveryResult): string {
  if (result.ok) return 'ok'

  return result.skipped ? 'skipped' : 'failed'
}

function failedStepLine(phase: InstallLogPhase, step: InstallLogItem): string {
  const output = step.output.trim()
  const detail = output ? `\n${output.split('\n').map((line) => `    ${line}`).join('\n')}` : ''

  return `  - ${phase.label}: ${step.label}${detail}`
}

function failedPhaseLines(phase: InstallLogPhase): string[] {
  const failedSteps = phase.items.filter((step) => !step.ok)
  if (failedSteps.length === 0) return [`  - ${phase.label}: failed`]

  return failedSteps.map((step) => failedStepLine(phase, step))
}

// The printer's own token, not the sentence the modal showed: the sentence is translated and written
// for the user, and whoever reads the report needs the word the printer actually used.
function pluginLines(result: PluginRecoveryResult): string[] {
  const reason = result.reason ? `: ${result.reason}` : ''
  const summary = `- ${result.pluginId}: ${outcomeWord(result)}${reason}`
  if (result.ok) return [summary]

  return [summary, ...result.log.filter((phase) => !phase.ok).flatMap(failedPhaseLines)]
}

function unreadableLine(warning: ManifestWarning): string {
  return `- ${warning.plugin}: unreadable (${warning.problem}) ${warning.detail}`
}

export function buildBatchReport(operation: string, results: BatchResult): string {
  const unreadable = (results.manifestWarnings ?? []).map(unreadableLine)

  return [
    `### Bespok3d ${operation} batch`,
    `- app: ${appVersion()}`,
    `- outcome: ${results.ok ? 'ok' : 'finished with errors'}`,
    '',
    '### Plugins',
    ...results.results.flatMap(pluginLines),
    ...(unreadable.length > 0 ? ['', '### Plugins the printer could not read', ...unreadable] : []),
  ].join('\n')
}
