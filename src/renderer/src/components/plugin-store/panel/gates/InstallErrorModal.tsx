// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../../i18n/context'
import { Button } from '../../../common/Button'
import type { Plugin, Printer } from '../../../../data/types'
import { buildBugReport, repoIssueUrl } from '../../safety/bug-report'
import { useBugReport } from '../../safety/useBugReport'
import { BugReportModal } from '../../safety/BugReportModal'
import { isPackageRefusal, refusalReason } from './refusal'
import { isMalformedPackage, malformedPackageDetail, type MalformedPackageDetail } from './malformed'

// Shown when an install OR uninstall fails, replacing the terse footer line. Progressive disclosure for
// the 3 user tiers: a plain headline + reassurance + retry for the novice; the plain guidance for the
// intermediate; the raw error + a ready-to-share report for the expert. The raw daemon message is kept
// behind the Technical-details expander so it is never the primary, unexplained surface. The verb is the
// op that actually failed (`kind`), so a failed removal never reads "Could not install".
//
// Two failures are not generic and get their own copy. A package REFUSAL (failed a security check) puts
// its already-user-facing reason as the primary guidance with no expander. A MALFORMED package (the
// daemon's integrity 409: the .b3 carried files its signed manifest does not vouch for) is a packaging
// defect, not a printer fault and not retry-able, so it says so, lists the offending files behind the
// toggle, and offers no Retry.
type Translate = ReturnType<typeof useI18n>['t']

interface ErrorCopy {
  title: string
  subtitle: string
  guidance: string
  tech?: string
  showRetry: boolean
}

const MALFORMED_REASON_TOKENS = ['undeclared_member', 'escaping_member', 'checksum_mismatch', 'escaping_plugin_id']

function reasonKey(reason: string): string {
  return MALFORMED_REASON_TOKENS.includes(reason) ? `install_malformed.reason.${reason}` : 'install_malformed.reason.unknown'
}

function malformedTech(t: Translate, detail: MalformedPackageDetail): string {
  const heading = t(reasonKey(detail.reason))
  if (detail.paths.length === 0) return heading

  return `${heading}\n${detail.paths.join('\n')}`
}

function malformedCopy(t: Translate, plugin: Plugin, detail: MalformedPackageDetail): ErrorCopy {
  return {
    title: t('install_malformed.title', { name: plugin.title }),
    subtitle: t('install_malformed.subtitle'),
    guidance: t('install_malformed.guidance'),
    tech: malformedTech(t, detail),
    showRetry: false,
  }
}

function refusedCopy(t: Translate, plugin: Plugin, errorMsg: string): ErrorCopy {
  return {
    title: t('install_refused.title', { name: plugin.title }),
    subtitle: t('install_refused.subtitle'),
    guidance: refusalReason(errorMsg),
    showRetry: true,
  }
}

function genericCopy(t: Translate, plugin: Plugin, kind: 'install' | 'uninstall', errorMsg: string): ErrorCopy {
  const prefix = kind === 'uninstall' ? 'uninstall_error' : 'install_error'

  return {
    title: t(`${prefix}.title`, { name: plugin.title }),
    subtitle: t(`${prefix}.subtitle`),
    guidance: t(`${prefix}.guidance`),
    tech: errorMsg,
    showRetry: true,
  }
}

function errorCopy(t: Translate, plugin: Plugin, kind: 'install' | 'uninstall', errorMsg: string, malformed: MalformedPackageDetail | null): ErrorCopy {
  if (malformed) return malformedCopy(t, plugin, malformed)
  if (isPackageRefusal(errorMsg)) return refusedCopy(t, plugin, errorMsg)

  return genericCopy(t, plugin, kind, errorMsg)
}

// The shareable report shows the decoded packaging fault for a malformed package (its raw message is a
// JSON blob behind a prefix), and the raw daemon text for every other failure.
function reportDetail(errorMsg: string, malformed: MalformedPackageDetail | null): string {
  if (!malformed) return errorMsg

  return `malformed package (${malformed.reason}):\n${malformed.paths.join('\n')}`
}

export function InstallErrorModal({ plugin, printer, kind, errorMsg, onRetry, onClose }: {
  plugin: Plugin; printer?: Printer | null; kind: 'install' | 'uninstall'; errorMsg: string; onRetry: () => void; onClose: () => void
}) {
  const { t } = useI18n()
  const malformed = isMalformedPackage(errorMsg) ? malformedPackageDetail(errorMsg) : null
  const copy = errorCopy(t, plugin, kind, errorMsg, malformed)
  const report = buildBugReport({ plugin, printer, detail: reportDetail(errorMsg, malformed), log: '' })
  const issueUrl = repoIssueUrl(plugin, `${plugin.id}: ${kind} failed`, report)
  const { copied, reportProblem } = useBugReport(report, issueUrl)
  function reportButtonLabel(): string {
    if (issueUrl) return t('install_error.report')

    return copied ? t('install_error.copied') : t('install_error.copy')
  }

  return (
    <BugReportModal
      title={copy.title}
      subtitle={copy.subtitle}
      guidance={copy.guidance}
      tech={copy.tech}
      techTone="danger"
      onClose={onClose}
      actions={
        <>
          {copy.showRetry && <Button variant="primary" onClick={onRetry}>{t('btn.retry')}</Button>}
          <Button variant="outline" onClick={reportProblem}>
            {reportButtonLabel()}
          </Button>
        </>
      }
    />
  )
}
