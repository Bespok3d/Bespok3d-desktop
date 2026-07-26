import { randomBytes, randomUUID } from 'crypto'
import { writeFileSync, existsSync } from 'fs'
import { homedir, hostname } from 'os'
import { join } from 'path'

import { describe, it, expect } from 'vitest'

// Registers the U1 adapter (its enroll steps + defaults) into the adapter registry.
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { getAdapter } from '@adapter-sdk'
import type { EnrollContext, EnrollStep } from '@adapter-sdk'
import { createPersistentSession } from '../../src/main/ssh'
import type { SshSession } from '../../src/main/ssh'

// Headless, hardware-in-the-loop enrollment harness. It drives the SAME canonical ENROLL_STEPS the
// desktop app runs (no reimplementation), against a REAL printer named by B3D_ENROLL_TARGET, then
// writes the managed printer record the app would have written. Inert unless B3D_ENROLL_TARGET is set,
// so the Docker invitro suite and CI never touch a real device. This is the seed of the CI/CD test bed.
//
//   B3D_DEV_SOURCES=<workspace-root> B3D_ENROLL_TARGET=192.0.2.109 B3D_ENROLL_NICK=junior \
//     npx vitest run --config vitest.invitro.config.ts enroll-device

const targetIp = process.env.B3D_ENROLL_TARGET
const sshUser = process.env.B3D_ENROLL_USER ?? 'root'
const sshPassword = process.env.B3D_ENROLL_PASSWORD ?? 'snapmaker'
const sshPort = Number(process.env.B3D_ENROLL_PORT ?? '22')
const printerNick = process.env.B3D_ENROLL_NICK ?? 'junior'
const adapterId = 'snapmaker-u1'

const SSH_RETRYABLE = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTCONN'])

interface CompletedStep {
  id: string
  label: string
  detail: string
}

function isConnectionError(thrown: unknown): boolean {
  if (!(thrown instanceof Error)) return false
  const code = (thrown as NodeJS.ErrnoException).code
  const retryableCode = code !== undefined && SSH_RETRYABLE.has(code)

  return (
    retryableCode ||
    thrown.message.includes('Connection closed') ||
    thrown.message.includes('Not connected') ||
    thrown.message.includes('No response from server') ||
    thrown.message.includes('Handshake timed out')
  )
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function runStepWithRetry(step: EnrollStep, ssh: SshSession, ctx: EnrollContext, attempt: number): Promise<void> {
  try {
    await step.run(ssh, ctx)
  } catch (stepError) {
    if (!isConnectionError(stepError) || attempt >= 2) throw stepError
    await sleep(2_000 * (attempt + 1))

    return runStepWithRetry(step, ssh, ctx, attempt + 1)
  }
}

async function runStepsFromIndex(
  steps: EnrollStep[],
  index: number,
  ssh: SshSession,
  ctx: EnrollContext,
  done: CompletedStep[]
): Promise<CompletedStep[]> {
  if (index >= steps.length) return done
  const step = steps[index]
  console.log(`[${index + 1}/${steps.length}] ${step.id} - ${step.label}`)
  await runStepWithRetry(step, ssh, ctx, 0)

  return runStepsFromIndex(steps, index + 1, ssh, ctx, [...done, { id: step.id, label: step.label, detail: step.detail }])
}

function makeEnrollContext(printerId: string): EnrollContext {
  return {
    printerId,
    ip: targetIp as string,
    credentials: { user: sshUser, password: sshPassword, port: sshPort },
    runtimeUser: 'lava',
    daemonToken: randomBytes(32).toString('hex'),
    clientId: randomUUID(),
    clientLabel: hostname(),
    onProgress: (hint: string) => console.log(`        ${hint}`),
  }
}

function printerStoreDirs(): string[] {
  const base = join(homedir(), 'Library', 'Application Support')

  return ['bespok3d', 'Bespok3d Dev']
    .map((productName) => join(base, productName, 'printers'))
    .filter((dir) => existsSync(dir))
}

function writeManagedRecord(record: Record<string, unknown>): void {
  printerStoreDirs().forEach((dir) => {
    const recordPath = join(dir, `${record.id as string}.json`)
    writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf-8')
    console.log(`record written: ${recordPath}`)
  })
}

const enrollIt = targetIp ? it : it.skip

describe('headless device enrollment (HIL harness)', () => {
  enrollIt(
    'enrolls the target printer with the canonical steps and writes its managed record',
    async () => {
      const printerId = `p-${Date.now()}`
      const ctx = makeEnrollContext(printerId)
      const steps = getAdapter(adapterId)?.enrollSteps
      if (!steps) throw new Error('snapmaker-u1 adapter is not registered')

      const session = createPersistentSession(() => ({
        host: ctx.ip,
        port: ctx.credentials.port,
        user: ctx.credentials.user,
        password: ctx.credentials.password,
      }))

      const completed = await runStepsFromIndex(steps, 0, session, ctx, [])
      const serial = (await session.exec('cat /oem/printer_data/.lava.sn 2>/dev/null || true')).trim()
      session.close()

      expect(completed.map((step) => step.id)).toContain('verify')
      expect(ctx.daemonCert).toBeTruthy()

      writeManagedRecord({
        id: printerId,
        nick: printerNick,
        model: 'Snapmaker U1',
        adapter: adapterId,
        host: serial ? `U1-${serial}.local` : ctx.ip,
        ip: ctx.ip,
        status: 'managed',
        customSshCredentials: false,
        installedIds: [],
        daemonToken: ctx.daemonToken,
        daemonCert: ctx.daemonCert,
        accessIdentity: ctx.clientFingerprint ?? ctx.clientId,
        enrollmentLog: { enrolledAt: new Date().toISOString(), adapterId, steps: completed },
      })
    },
    1_200_000
  )
})
