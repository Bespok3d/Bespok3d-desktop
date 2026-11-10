// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PrinterRecord } from '../printers'
import type { InstallLogPhase, InstallLog } from '@bespok3d/contract'
import type { BatchResult } from './batch-result'
import { manifestWarningsIn } from './batch-result'
import { DaemonHttpError, doRequest, LONG_OP_TIMEOUT_MS, type UploadProgressFn } from './transport'

function toInstallLog(text: string): InstallLog {
  const result = JSON.parse(text) as { plugin_id: string; ok: boolean; log: InstallLogPhase[] }

  return { pluginId: result.plugin_id, timestamp: Date.now(), ok: result.ok, phases: result.log ?? [] }
}

function buildMultipart(
  boundary: string,
  pluginId: string,
  b3Data: Buffer,
  vars?: Record<string, string>,
): Buffer {
  const nl = '\r\n'
  const fileHeader =
    `--${boundary}${nl}` +
    `Content-Disposition: form-data; name="file"; filename="${pluginId}.b3"${nl}` +
    `Content-Type: application/octet-stream${nl}${nl}`
  const parts: Buffer[] = [Buffer.from(fileHeader), b3Data, Buffer.from(nl)]
  if (vars && Object.keys(vars).length > 0) {
    const varHeader =
      `--${boundary}${nl}Content-Disposition: form-data; name="vars_json"${nl}${nl}`
    parts.push(Buffer.from(varHeader + JSON.stringify(vars) + nl))
  }
  parts.push(Buffer.from(`--${boundary}--${nl}`))

  return Buffer.concat(parts)
}

export async function installPlugin(
  record: PrinterRecord,
  b3Data: Buffer,
  pluginId: string,
  vars?: Record<string, string>,
  onUploadProgress?: UploadProgressFn,
): Promise<InstallLog> {
  const boundary = `----B3Boundary${Date.now()}`
  const body = buildMultipart(boundary, pluginId, b3Data, vars)
  const text = await doRequest(
    record,
    'POST',
    '/plugins/install',
    body,
    `multipart/form-data; boundary=${boundary}`,
    LONG_OP_TIMEOUT_MS,
    onUploadProgress,
  )

  return toInstallLog(text)
}

export async function uninstallPlugin(record: PrinterRecord, pluginId: string, cascade = false): Promise<string[]> {
  const query = cascade ? '?cascade=true' : ''
  const text = await doRequest(record, 'DELETE', `/plugins/${pluginId}${query}`, undefined, undefined, LONG_OP_TIMEOUT_MS)

  return (JSON.parse(text) as { ok: boolean; removed?: string[] }).removed ?? []
}

export async function reconfigurePlugin(
  record: PrinterRecord,
  pluginId: string,
  vars: Record<string, string>,
): Promise<InstallLog> {
  const text = await doRequest(
    record,
    'POST',
    `/plugins/${pluginId}/reconfigure`,
    Buffer.from(JSON.stringify(vars)),
    'application/json',
    LONG_OP_TIMEOUT_MS,
  )

  return toInstallLog(text)
}

export async function deactivateAll(record: PrinterRecord): Promise<void> {
  await doRequest(record, 'POST', '/deactivate', undefined, undefined, LONG_OP_TIMEOUT_MS)
}

export async function teardownDaemon(record: PrinterRecord): Promise<void> {
  await doRequest(record, 'POST', '/teardown', undefined, undefined, LONG_OP_TIMEOUT_MS)
}

function parseBatchResult(text: string): BatchResult {
  const raw = JSON.parse(text) as {
    ok: boolean
    results: Array<{ plugin_id: string; ok: boolean; skipped: boolean; reason: string; log: InstallLogPhase[]; auto_deactivated?: string | null; fix_detail?: string; changed_files?: string[] }>
    manifest_warnings?: unknown
  }

  return {
    ok: raw.ok,
    manifestWarnings: manifestWarningsIn(raw.manifest_warnings),
    results: raw.results.map((item) => ({
      pluginId: item.plugin_id,
      ok: item.ok,
      skipped: item.skipped ?? false,
      reason: item.reason ?? '',
      log: item.log ?? [],
      autoDeactivated: item.auto_deactivated ?? undefined,
      fixDetail: item.fix_detail ?? undefined,
      changedFiles: item.changed_files ?? [],
    })),
  }
}

// A caller that reboots the printer right after says so: the reboot restarts every service, so the
// printer skips its own services restart instead of running it only to have the reboot do it again.
export async function recoverPackages(record: PrinterRecord, rebootFollows = false): Promise<BatchResult> {
  const body = rebootFollows ? Buffer.from(JSON.stringify({ reboot_follows: true })) : undefined
  const contentType = rebootFollows ? 'application/json' : undefined

  return parseBatchResult(await doRequest(record, 'POST', '/packages/recover', body, contentType, LONG_OP_TIMEOUT_MS))
}

// The printer's daemon answers before its services are all up after a reboot, and a print can already
// be running then. The printer refuses the check for either (422, 409) and keeps what the check needs
// until it has run, so it is asked again a little later, a few times, before the report goes up without it.
const AFTER_REBOOT_ATTEMPTS = 4
const AFTER_REBOOT_RETRY_MS = 15_000

function printerAsksToBeAskedAgain(error: unknown): boolean {
  return error instanceof DaemonHttpError && (error.statusCode === 409 || error.statusCode === 422)
}

// The check a recover that a reboot followed left to that reboot: no rows when it left none, else the
// row that replaces the one saying the reboot replaced the services restart.
export async function recoverAfterReboot(record: PrinterRecord, attemptsLeft = AFTER_REBOOT_ATTEMPTS): Promise<BatchResult> {
  try {
    return parseBatchResult(await doRequest(record, 'POST', '/packages/recover/after-reboot', undefined, undefined, LONG_OP_TIMEOUT_MS))
  } catch (error) {
    if (!printerAsksToBeAskedAgain(error) || attemptsLeft <= 1) throw error
    await new Promise<void>((resolve) => setTimeout(resolve, AFTER_REBOOT_RETRY_MS))

    return recoverAfterReboot(record, attemptsLeft - 1)
  }
}

function printerAskedForTheFullRecover(error: unknown): boolean {
  return error instanceof DaemonHttpError && error.statusCode === 409
    && (error.detail as { error?: string } | null)?.error === 'needs_recover'
}

// A printer that only lost its setup (the include lines) gets just that put back, with no plugin
// re-applied. The printer refuses that smaller repair whenever its selfcheck reports anything more, and
// only then is every plugin put back (Bespok3d-desktop#30).
export async function repairOrRecover(record: PrinterRecord, rebootFollows: boolean): Promise<BatchResult> {
  try {
    return parseBatchResult(await doRequest(record, 'POST', '/packages/repair-setup', undefined, undefined, LONG_OP_TIMEOUT_MS))
  } catch (error) {
    if (!printerAskedForTheFullRecover(error)) throw error

    return recoverPackages(record, rebootFollows)
  }
}

export interface BatchUpdatePackage {
  pluginId: string
  bytes: Buffer
  vars?: Record<string, string>
}

function buildBatchMultipart(boundary: string, packages: BatchUpdatePackage[], varsById: Record<string, Record<string, string>>): Buffer {
  const nl = '\r\n'
  const parts: Buffer[] = []
  packages.forEach((pkg) => {
    const fileHeader =
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="files"; filename="${pkg.pluginId}.b3"${nl}` +
      `Content-Type: application/octet-stream${nl}${nl}`
    parts.push(Buffer.from(fileHeader), pkg.bytes, Buffer.from(nl))
  })
  const varHeader = `--${boundary}${nl}Content-Disposition: form-data; name="vars_json"${nl}${nl}`
  parts.push(Buffer.from(varHeader + JSON.stringify(varsById) + nl))
  parts.push(Buffer.from(`--${boundary}--${nl}`))

  return Buffer.concat(parts)
}

export async function uninstallBatch(record: PrinterRecord, pluginIds: string[], cascade: boolean): Promise<BatchResult> {
  const body = Buffer.from(JSON.stringify({ plugin_ids: pluginIds, cascade }))
  const text = await doRequest(record, 'POST', '/packages/uninstall-batch', body, 'application/json', LONG_OP_TIMEOUT_MS)

  return parseBatchResult(text)
}

// Post several .b3 packages to a batch route (update-batch or install-batch), which applies them all
// and restarts the affected services once. The two routes share the exact multipart shape; only the
// daemon-side semantics differ (install checks conflicts and reports an install), so this is one poster.
async function postBatchPackages(record: PrinterRecord, route: string, packages: BatchUpdatePackage[], onUploadProgress?: UploadProgressFn): Promise<BatchResult> {
  const boundary = `----B3Boundary${Date.now()}`
  const varsById: Record<string, Record<string, string>> = {}
  packages.forEach((pkg) => {
    if (pkg.vars && Object.keys(pkg.vars).length > 0) varsById[pkg.pluginId] = pkg.vars
  })
  const body = buildBatchMultipart(boundary, packages, varsById)
  const text = await doRequest(record, 'POST', route, body, `multipart/form-data; boundary=${boundary}`, LONG_OP_TIMEOUT_MS, onUploadProgress)

  return parseBatchResult(text)
}

export function updateBatchPackages(record: PrinterRecord, packages: BatchUpdatePackage[], onUploadProgress?: UploadProgressFn): Promise<BatchResult> {
  return postBatchPackages(record, '/packages/update-batch', packages, onUploadProgress)
}

export function installBatchPackages(record: PrinterRecord, packages: BatchUpdatePackage[], onUploadProgress?: UploadProgressFn): Promise<BatchResult> {
  return postBatchPackages(record, '/packages/install-batch', packages, onUploadProgress)
}
