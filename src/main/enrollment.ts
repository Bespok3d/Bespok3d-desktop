// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'crypto'
import { hostname } from 'os'
import type { BrowserWindow } from 'electron'
import { connect, createPersistentSession } from './ssh'
import type { SshSession } from './ssh'
import { getAdapter } from './adapter-loader'
import type { SshCredentials, EnrollContext, EnrollStep } from './adapter-loader'
import { listKeys } from './keys'
import { loadSettings, clientId } from './settings'
import { updatePrinter } from './printers'
import { assertKnownPrinterNotDowngraded } from './compat'
import { stepFractionCarry } from './step-progress'
import { reportEvent } from './analytics'
import { reportErrorEvent } from './analytics/errors'

export interface CompletedStep {
  id: string
  label: string
  detail: string
}

export interface EnrollProgressEvent {
  printerId: string
  stepId: string
  stepLabel: string
  stepDetail: string
  status: 'running' | 'done' | 'failed'
  error?: string
  errorDetail?: string
  hint?: string
  // How far through the running step its own work has got, 0..1, when the step can measure that.
  stepFraction?: number
  stepIndex: number
  totalSteps: number
  completedSteps: CompletedStep[]
}

export interface SshCheckResult {
  ok: boolean
  error?: string
}

const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 2000

const SSH_RETRYABLE = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTCONN'])

function isConnectionError(thrown: unknown): boolean {
  if (!(thrown instanceof Error)) return false
  const code = (thrown as NodeJS.ErrnoException).code
  const msg = thrown.message

  return (
    (code !== undefined && SSH_RETRYABLE.has(code)) ||
    msg.includes('Connection closed') ||
    msg.includes('Not connected') ||
    msg.includes('No response from server') ||
    msg.includes('Handshake timed out')
  )
}

async function runAttempt(
  step: EnrollStep,
  session: SshSession,
  ctx: EnrollContext,
  attempt: number
): Promise<void> {
  try {
    await step.run(session, ctx)
  } catch (stepError) {
    if (!isConnectionError(stepError) || attempt + 1 >= MAX_RETRY_ATTEMPTS) throw stepError
    await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))

    return runAttempt(step, session, ctx, attempt + 1)
  }
}

async function runWithRetry(
  step: EnrollStep,
  session: SshSession,
  ctx: EnrollContext
): Promise<void> {
  return runAttempt(step, session, ctx, 0)
}

function emit(win: BrowserWindow, event: EnrollProgressEvent): void {
  win.webContents.send('printers:enroll:progress', event)
}

type BaseEvent = Omit<EnrollProgressEvent, 'status' | 'error' | 'errorDetail' | 'completedSteps'>
type StepRunResult = { failed: boolean; completed: CompletedStep[] }

function makeBaseEvent(
  printerId: string,
  step: EnrollStep,
  stepIndex: number,
  totalSteps: number
): BaseEvent {
  return {
    printerId,
    stepId: step.id,
    stepLabel: step.label,
    stepDetail: step.detail,
    stepIndex,
    totalSteps,
  }
}

async function runStep(
  win: BrowserWindow,
  step: EnrollStep,
  stepIndex: number,
  totalSteps: number,
  printerId: string,
  session: SshSession,
  ctx: EnrollContext,
  completedSoFar: CompletedStep[]
): Promise<StepRunResult> {
  const base = makeBaseEvent(printerId, step, stepIndex, totalSteps)
  emit(win, { ...base, status: 'running', completedSteps: [...completedSoFar] })
  const carry = stepFractionCarry()
  ctx.onProgress = (hint, stepFraction) =>
    emit(win, { ...base, status: 'running', hint, stepFraction: carry(stepFraction), completedSteps: [...completedSoFar] })
  try {
    await runWithRetry(step, session, ctx)
  } catch (stepError) {
    const errorMessage = stepError instanceof Error ? stepError.message : String(stepError)
    emit(win, { ...base, status: 'failed', error: errorMessage, errorDetail: errorMessage, completedSteps: [...completedSoFar] })
    // A user left with a printer that did not enrol. Only the kind of failure goes out: the message
    // on screen names the printer, the step and often the network it is on, and none of that is ours.
    reportErrorEvent(stepError, 'enrollment')

    return { failed: true, completed: completedSoFar }
  }
  const nowCompleted = [...completedSoFar, { id: step.id, label: step.label, detail: step.detail }]
  emit(win, { ...base, status: 'done', completedSteps: nowCompleted })

  return { failed: false, completed: nowCompleted }
}

export async function checkSsh(
  ip: string,
  credentials: SshCredentials
): Promise<SshCheckResult> {
  try {
    const session = await connect({ host: ip, port: credentials.port, user: credentials.user, password: credentials.password })
    await session.exec('echo ok')
    session.close()

    return { ok: true }
  } catch (sshError) {
    return { ok: false, error: sshError instanceof Error ? sshError.message : String(sshError) }
  }
}

function markEnrolled(
  printerId: string,
  adapterId: string,
  completed: CompletedStep[],
  ctx: EnrollContext
): void {
  // Merge the enrollment result onto the freshly read record (no-op if the printer was removed
  // mid-enroll): a status ping that landed during the multi-step enrollment touched other fields, so a
  // whole-record write captured before all the SSH awaits would clobber it.
  updatePrinter(printerId, (current) => {
    const originalEnrolledAt = current.enrollmentLog?.enrolledAt

    return {
      status: 'managed',
      daemonToken: ctx.daemonToken,
      daemonCert: ctx.daemonCert,
      accessIdentity: ctx.clientFingerprint || ctx.clientId,
      daemonUpdatedAt: originalEnrolledAt ? new Date().toISOString() : undefined,
      enrollmentLog: {
        enrolledAt: originalEnrolledAt ?? new Date().toISOString(),
        adapterId,
        steps: completed,
      },
    }
  })
}

function makeContext(
  printerId: string,
  ip: string,
  credentials: SshCredentials,
  runtimeUser: string,
): EnrollContext {
  const pgpEnabled = loadSettings().pgpEnabled
  const printerKey = pgpEnabled
    ? listKeys().find(
        (key) => key.assignments.some((assignment) => assignment.purpose === 'printers') || key.isDefault
      )
    : undefined

  return {
    printerId, ip, credentials, runtimeUser,
    daemonToken: randomBytes(32).toString('hex'),
    clientId: clientId(),
    clientLabel: hostname(),
    clientPublicKey: printerKey?.publicKey,
    clientFingerprint: printerKey?.fingerprint,
  }
}

export async function enrollPrinter(
  win: BrowserWindow,
  printerId: string,
  ip: string,
  adapterId: string,
  credentials: SshCredentials,
  retryFromStepId?: string
): Promise<void> {
  const adapter = getAdapter(adapterId)
  if (!adapter) throw new Error(`Unknown adapter: ${adapterId}`)
  // Recovery after a firmware update runs this same path against a printer that is already managed and
  // may be running a newer daemon than this app ships. A printer with no record, or one that answers
  // nothing, is a first enrollment and passes straight through.
  await assertKnownPrinterNotDowngraded(printerId)

  const steps = adapter.enrollSteps
  const startIndex = retryFromStepId
    ? Math.max(0, steps.findIndex((step) => step.id === retryFromStepId))
    : 0

  const ctx = makeContext(printerId, ip, credentials, adapter.defaults.runtimeUser)

  const session = createPersistentSession(() => ({
    host: ctx.ip,
    port: credentials.port,
    user: credentials.user,
    password: credentials.password,
  }))

  const totalSteps = steps.length

  async function runStepFromIndex(stepIndex: number, completed: CompletedStep[]): Promise<StepRunResult> {
    if (stepIndex >= totalSteps) return { failed: false, completed }
    const stepResult = await runStep(win, steps[stepIndex], stepIndex, totalSteps, printerId, session, ctx, completed)
    if (stepResult.failed) return stepResult

    return runStepFromIndex(stepIndex + 1, stepResult.completed)
  }

  const result = await runStepFromIndex(startIndex, [])

  session.close()
  if (result.failed) return

  markEnrolled(printerId, adapterId, result.completed, ctx)
  // Every step ran and the printer is enrolled. An enrollment the user abandoned, or one a step
  // refused, is not an enrollment and is counted as nothing.
  reportEvent('printer_enrolled', {})
}
