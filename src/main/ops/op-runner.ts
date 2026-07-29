// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserWindow } from 'electron'
import type { EnrollProgressEvent, CompletedStep } from '../enrollment'
import { connect } from '../ssh'
import type { SshSession } from '../ssh'

export interface OpStep {
  id: string
  label: string
  detail: string
  run: (progress: (hint: string) => void) => Promise<void>
}

type OpAcc = { failed: boolean; completed: CompletedStep[] }

function emitOpEvent(win: BrowserWindow, event: EnrollProgressEvent): void {
  win.webContents.send('printers:enroll:progress', event)
}

function makeOpEvent(
  printerId: string, step: OpStep, index: number, total: number,
  status: 'running' | 'done' | 'failed', completed: CompletedStep[], error?: string,
): EnrollProgressEvent {
  return {
    printerId, stepId: step.id, stepLabel: step.label, stepDetail: step.detail,
    status, error, errorDetail: error, stepIndex: index, totalSteps: total, completedSteps: completed,
  }
}

// Run an ordered list of steps, streaming a running/done event per step to the renderer (the same
// EnrollProgressEvent feed enrollment uses) and stopping at the first failure with a failed event.
export async function execOpSteps(win: BrowserWindow, printerId: string, steps: OpStep[]): Promise<void> {
  async function tryRunOpStep(step: OpStep, index: number, completed: CompletedStep[]): Promise<OpAcc> {
    emitOpEvent(win, makeOpEvent(printerId, step, index, steps.length, 'running', completed))
    function progress(hint: string): void {
      emitOpEvent(win, { ...makeOpEvent(printerId, step, index, steps.length, 'running', completed), hint })
    }
    try {
      await step.run(progress)
    } catch (stepError) {
      emitOpEvent(win, makeOpEvent(printerId, step, index, steps.length, 'failed', completed, String(stepError)))

      return { failed: true, completed }
    }
    const nextCompleted = [...completed, { id: step.id, label: step.label, detail: step.detail }]
    emitOpEvent(win, makeOpEvent(printerId, step, index, steps.length, 'done', nextCompleted))

    return { failed: false, completed: nextCompleted }
  }

  async function runOpStepFromIndex(index: number, completed: CompletedStep[]): Promise<OpAcc> {
    if (index >= steps.length) return { failed: false, completed }
    const stepResult = await tryRunOpStep(steps[index], index, completed)
    if (stepResult.failed) return stepResult

    return runOpStepFromIndex(index + 1, stepResult.completed)
  }

  const final = await runOpStepFromIndex(0, [])
  if (final.failed) throw new Error('Operation failed')
}

// The connect/run/close spine every SSH device op shares: open the session, run the caller's steps
// (built against the open session) with live progress, and always close. The caller loads its record
// before and merges the result with updatePrinter after (a field-level write, so a status ping that
// landed during the op is not clobbered).
export async function runSshOp(
  win: BrowserWindow,
  printerId: string,
  credentials: { host: string; port: number; user: string; password: string },
  buildSteps: (ssh: SshSession) => OpStep[],
): Promise<void> {
  const ssh = await connect(credentials)
  try {
    await execOpSteps(win, printerId, buildSteps(ssh))
  } finally {
    ssh.close()
  }
}
