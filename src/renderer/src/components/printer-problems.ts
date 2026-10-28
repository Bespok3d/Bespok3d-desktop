// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PrinterProblem } from '../data/types'

type ProblemBannerCase = 'bespok3d' | 'plugin_half_removed' | 'plugin_recovery_failed'

export interface ProblemBannerCopy {
  bodyKey: string
  actionKey: string
  pluginNames: string
}

const PLUGIN_PROBLEM_KINDS = ['plugin_half_removed', 'plugin_recovery_failed']
const KNOWN_PROBLEM_KINDS = ['includes_missing', 'includes_present_while_off', 'directory_missing', ...PLUGIN_PROBLEM_KINDS]

const COPY_BY_CASE: Record<ProblemBannerCase, { bodyKey: string; actionKey: string }> = {
  bespok3d: { bodyKey: 'banner.printer_problem_bespok3d_body', actionKey: 'banner.printer_problem_action' },
  plugin_half_removed: { bodyKey: 'banner.printer_problem_half_removed_body', actionKey: 'banner.printer_problem_cleanup_action' },
  plugin_recovery_failed: { bodyKey: 'banner.printer_problem_recovery_failed_body', actionKey: 'banner.printer_problem_action' },
}

function isPluginProblem(problem: PrinterProblem): boolean {
  return PLUGIN_PROBLEM_KINDS.includes(problem.kind)
}

// Bespok3d's own setup outranks any one plugin: a printer that no longer loads Bespok3d is the
// bigger fault, and putting it back is what the button does then. A kind this build predates counts
// as Bespok3d's own, so the user is never told a plugin is at fault on a guess.
function bannerCase(problems: PrinterProblem[]): ProblemBannerCase {
  if (!problems.every(isPluginProblem)) return 'bespok3d'

  return problems.some((problem) => problem.kind === 'plugin_half_removed') ? 'plugin_half_removed' : 'plugin_recovery_failed'
}

export function problemPluginName(problem: PrinterProblem): string {
  return problem.pluginId ?? problem.detail
}

export function problemBannerCopy(problems: PrinterProblem[]): ProblemBannerCopy {
  const shownCase = bannerCase(problems)
  const pluginNames = problems.filter((problem) => problem.kind === shownCase).map(problemPluginName).join(', ')

  return { ...COPY_BY_CASE[shownCase], pluginNames }
}

export function problemLineKey(problem: PrinterProblem): string {
  const lineKind = KNOWN_PROBLEM_KINDS.includes(problem.kind) ? problem.kind : 'unknown'

  return `banner.printer_problem_line.${lineKind}`
}
