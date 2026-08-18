// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer } from '../../data/types'
import { SOURCE_REPOSITORY_URL, githubIssueUrl } from '../../utils/source-repository'
import type { EnrollMode } from './index'

export interface FailedOpDetail {
  stepLabel?: string
  reason: string
}

export function failureIssueTitle(mode: EnrollMode, detail: FailedOpDetail): string {
  const step = detail.stepLabel ? `: ${detail.stepLabel}` : ''

  return `${mode} failed${step}`
}

// What a maintainer would otherwise have to ask for: which operation, which step refused, its own
// reason, and the versions on both sides. Markdown so it lands readable in the issue form.
export function buildFailureIssueBody(printer: Printer, mode: EnrollMode, detail: FailedOpDetail): string {
  return [
    '### What failed',
    `- operation: ${mode}`,
    `- step: ${detail.stepLabel ?? 'never started'}`,
    '- reason:',
    '',
    '```',
    detail.reason.trim() || '(no reason reported)',
    '```',
    '',
    '### Environment',
    `- bespok3d app: ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown'}`,
    `- daemon: ${printer.daemonVersion ?? 'unknown'}`,
    `- adapter: ${printer.adapter ?? 'unknown'}`,
    `- jinni: ${printer.jinniVersion ?? 'unknown'}`,
    `- printer: ${printer.model ?? 'unknown'}`,
    `- firmware: ${printer.firmwareVersion ?? 'unknown'}`,
    '',
    '### What I was doing',
    '',
  ].join('\n')
}

// The way out of a failed operation for someone who cannot fix it themselves: the report is already
// written, so all they do is press Submit.
export function reportOpFailure(printer: Printer, mode: EnrollMode, detail: FailedOpDetail): void {
  const url = githubIssueUrl(SOURCE_REPOSITORY_URL, failureIssueTitle(mode, detail), buildFailureIssueBody(printer, mode, detail))
  void window.b3d.openUrl(url)
}
