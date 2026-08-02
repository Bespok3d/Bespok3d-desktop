// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The one place a failed update read is turned into words, so the version list, the update status line
// and the update modal never drift into saying three different things about the same failure.
const PROBLEM_TEXT: Record<UpdateProblem, string> = {
  notPublished: 'set.update.problem_not_published',
  unreachable: 'set.update.problem_unreachable',
  unavailable: 'set.update.problem_unavailable',
}

export function updateProblemTextKey(problem: UpdateProblem): string {
  return PROBLEM_TEXT[problem] ?? PROBLEM_TEXT.unavailable
}
