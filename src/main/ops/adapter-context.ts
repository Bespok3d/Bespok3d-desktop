// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getAdapter } from '../adapter-loader'
import type { AdapterDefinition, EnrollContext, EnrollStep, SshCredentials } from '../adapter-loader'
import { loadPrinters } from '../printers'
import type { PrinterRecord } from '../printers'
import { recordOrThrow } from '../daemon-client/status'
import type { SshSession } from '../ssh'
import type { OpStep } from './op-runner'

// What an adapter step is handed when an op (rather than an enrolment) runs it: the same context
// enrolment builds, minus the one-time key material enrolment alone produces.
function opEnrollContext(record: PrinterRecord, ip: string, credentials: SshCredentials, runtimeUser: string): EnrollContext {
  return {
    printerId: record.id,
    ip,
    credentials,
    runtimeUser,
    daemonToken: record.daemonToken,
    daemonCert: record.daemonCert,
  }
}

// The adapter + enroll context an op runs against, for a record the caller already loaded (deactivate
// and uninstall load theirs through getManagedRecord, because they also talk to the daemon).
export function adapterOpContext(record: PrinterRecord, ip: string, credentials: SshCredentials): { adapter: AdapterDefinition; ctx: EnrollContext } {
  const adapter = getAdapter(record.adapter)
  if (!adapter) throw new Error('adapter not found')

  return { adapter, ctx: opEnrollContext(record, ip, credentials, adapter.defaults.runtimeUser) }
}

// The record + adapter + enroll context the daemon-maintenance ops all open with; throws the same way
// each did inline so a missing record or adapter still fails loudly before any SSH work.
export function daemonOpContext(printerId: string, ip: string, credentials: SshCredentials): { record: PrinterRecord; adapter: AdapterDefinition; ctx: EnrollContext } {
  const record = recordOrThrow(printerId)

  return { record, ...adapterOpContext(record, ip, credentials) }
}

// The reboot op alone can run with no record: removing bespok3d deletes the printer's record before
// the reboot that follows it, so the adapter comes from the record when there is one and from what
// the caller still knows about the printer when there is not.
export function rebootOpContext(printerId: string, adapterId: string, ip: string, credentials: SshCredentials): { adapter: AdapterDefinition; ctx: EnrollContext } {
  const record = loadPrinters().find((candidate) => candidate.id === printerId)
  const adapter = getAdapter(record?.adapter ?? adapterId)
  if (!adapter) throw new Error('adapter not found')
  const ctx: EnrollContext = {
    printerId, ip, credentials, runtimeUser: adapter.defaults.runtimeUser,
    daemonToken: record?.daemonToken, daemonCert: record?.daemonCert,
  }

  return { adapter, ctx }
}

// An adapter's own steps, as steps the op runner can drive: same id, label and detail, with the
// runner's progress callback threaded into the context the adapter reads it from.
export function adapterOpSteps(steps: EnrollStep[], ssh: SshSession, ctx: EnrollContext): OpStep[] {
  return steps.map((step) => ({
    id: step.id,
    label: step.label,
    detail: step.detail,
    run: (progress: (hint: string, stepFraction?: number) => void) => step.run(ssh, { ...ctx, onProgress: progress }),
  }))
}
