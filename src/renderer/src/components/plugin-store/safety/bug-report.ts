// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, Printer } from '../../../data/types'

export interface ReportContext {
  plugin: Plugin
  printer?: Printer | null
  detail: string
  log: string
}

function appVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown'
}

function sourceRef(plugin: Plugin): string {
  return plugin.sources.map((source) => source.registryUrl).find(Boolean) ?? 'unknown'
}

const REPORT_LOG_PER_SECTION = 2500

// Keep a section's header + its TAIL (a traceback sits at the end of each service's log) within
// `maxChars`, so the most relevant lines survive trimming.
function tailCapSection(section: string, maxChars: number): string {
  if (section.length <= maxChars) return section
  const firstBreak = section.indexOf('\n')
  const header = firstBreak >= 0 ? section.slice(0, firstBreak + 1) : ''
  const body = section.slice(header.length)

  return `${header}...(earlier lines trimmed)...\n${body.slice(body.length - maxChars)}`
}

// Tail-cap EACH service section ("--- Klipper log ---", "--- Moonraker log ---") independently so a
// report carries BOTH tails. The old whole-body front-slice in repoIssueUrl kept the first (benign)
// section and cut the failing service's traceback off the end, making moonraker-plugin reports useless.
function trimReportLog(log: string): string {
  if (!log) return log

  return log.split(/\n\n(?=--- )/).map((section) => tailCapSection(section, REPORT_LOG_PER_SECTION)).join('\n\n')
}

// A ready-to-share report: enough environment + failure context that a plugin author can act on it
// without a back-and-forth. Markdown so it pastes cleanly into a GitHub issue.
export function buildBugReport(ctx: ReportContext): string {
  const { plugin, printer, detail, log } = ctx

  return [
    '### Plugin',
    `- id: ${plugin.id}`,
    `- version: ${plugin.version}`,
    `- publisher: ${plugin.publisher}`,
    `- source: ${sourceRef(plugin)}`,
    '',
    '### Environment',
    `- bespok3d app: ${appVersion()}`,
    `- daemon: ${printer?.daemonVersion ?? 'unknown'}`,
    `- adapter: ${printer?.adapter ?? 'unknown'}`,
    `- jinni: ${printer?.jinniVersion ?? 'unknown'}`,
    `- printer: ${printer?.model ?? 'unknown'}`,
    `- firmware: ${printer?.firmwareVersion ?? 'unknown'}`,
    '',
    '### What happened',
    detail,
    '',
    '### Captured log',
    '```',
    trimReportLog(log).trim() || '(no log captured)',
    '```',
  ].join('\n')
}

// A prefilled "New issue" URL for the plugin's repo, derived from its github: source ref. Returns
// null when the source is not a github ref (then the caller falls back to copy-to-clipboard).
export function repoIssueUrl(plugin: Plugin, title: string, body: string): string | null {
  const ref = plugin.sources.map((source) => source.registryUrl).find((url) => url.startsWith('github:'))
  if (!ref) return null
  const [owner, repo] = ref.slice('github:'.length).split('/')
  if (!owner || !repo) return null
  const query = `title=${encodeURIComponent(title)}&body=${encodeURIComponent(body.slice(0, 6000))}`

  return `https://github.com/${owner}/${repo}/issues/new?${query}`
}
