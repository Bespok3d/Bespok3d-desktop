// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, Printer } from '../../../data/types'
import { githubIssueUrl } from '../../../utils/source-repository'

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

function githubRepositoryFromDownloadUrl(downloadUrl: string | undefined): string | null {
  if (!downloadUrl) return null

  try {
    const downloadAddress = new URL(downloadUrl)
    const pathSegments = downloadAddress.pathname.split('/').filter(Boolean)
    const isReleaseDownload = pathSegments[2] === 'releases' && pathSegments[3] === 'download'
    if (downloadAddress.hostname !== 'github.com' || !isReleaseDownload) return null

    const [repositoryOwner, repositoryName] = pathSegments
    if (!repositoryOwner || !repositoryName) return null

    return `https://github.com/${repositoryOwner}/${repositoryName}`
  } catch {
    return null
  }
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

// A prefilled "New issue" URL for the plugin's repo, derived from its package download URL when
// possible and otherwise its github: source ref. Returns null when neither identifies a GitHub repo.
export function repoIssueUrl(plugin: Plugin, title: string, body: string): string | null {
  const downloadRepository = plugin.sources
    .map((source) => githubRepositoryFromDownloadUrl(source.downloadUrl))
    .find(Boolean)
  if (downloadRepository) return githubIssueUrl(downloadRepository, title, body)

  const registryRef = plugin.sources.map((source) => source.registryUrl).find((url) => url.startsWith('github:'))
  if (!registryRef) return null
  const [registryOwner, registryRepository] = registryRef.slice('github:'.length).split('/')
  if (!registryOwner || !registryRepository) return null

  return githubIssueUrl(`https://github.com/${registryOwner}/${registryRepository}`, title, body)
}
