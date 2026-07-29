// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useClipboard } from '../../common/hooks/useClipboard'

// Shared "send this report" behaviour for the two bug-report modals (install-failed, safety-disabled):
// open the plugin's prefilled GitHub issue when the source is a github ref, otherwise copy the report
// to the clipboard. `copyReport` is the explicit copy action the safety modal also offers alongside.
export function useBugReport(report: string, issueUrl: string | null) {
  const { copied, copy } = useClipboard()

  function copyReport() {
    copy(report)
  }
  function reportProblem() {
    if (issueUrl) void window.b3d.openUrl(issueUrl)
    else copyReport()
  }

  return { copied, copyReport, reportProblem }
}
