// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer } from '../../data/types'

export function buildHistoryEvent(printer: Printer): EnrollProgressEvent | null {
  const log = printer.enrollmentLog
  if (!log || log.steps.length === 0) return null
  const last = log.steps[log.steps.length - 1]

  return {
    printerId: printer.id,
    stepId: last.id,
    stepLabel: last.label,
    stepDetail: last.detail,
    status: 'done',
    stepIndex: log.steps.length - 1,
    totalSteps: log.steps.length,
    completedSteps: log.steps,
  }
}
