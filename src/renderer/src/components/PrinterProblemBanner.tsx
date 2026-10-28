// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PrinterProblem } from '../data/types'
import { useI18n } from '../i18n/context'
import { PrinterBanner } from './common/PrinterBanner'
import { Explainer } from './common/content/Explainer'
import { problemBannerCopy, problemLineKey, problemPluginName } from './printer-problems'

export function PrinterProblemBanner({ printerName, problems, onAction }: { printerName: string; problems: PrinterProblem[]; onAction: () => void }) {
  const { t } = useI18n()
  const copy = problemBannerCopy(problems)
  const problemLines = problems.map((problem) => t(problemLineKey(problem), { plugin: problemPluginName(problem), detail: problem.detail }))

  return (
    <PrinterBanner
      message={<Explainer brief={t(copy.bodyKey, { name: printerName, plugin: copy.pluginNames })} detail={problemLines.map((line) => <span key={line}>{line}<br /></span>)} />}
      actionLabel={t(copy.actionKey)}
      onAction={onAction}
    />
  )
}
