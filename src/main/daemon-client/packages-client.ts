import type { PrinterRecord } from '../printers'
import type { InstallLogPhase, InstallLog, RecoverResult } from '@bespok3d/contract'
import { doRequest, LONG_OP_TIMEOUT_MS, type UploadProgressFn } from './transport'

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

function parseRecoverResult(text: string): RecoverResult {
  const raw = JSON.parse(text) as {
    ok: boolean
    results: Array<{ plugin_id: string; ok: boolean; skipped: boolean; reason: string; log: InstallLogPhase[]; auto_deactivated?: string | null; fix_detail?: string }>
  }

  return {
    ok: raw.ok,
    results: raw.results.map((item) => ({
      pluginId: item.plugin_id,
      ok: item.ok,
      skipped: item.skipped ?? false,
      reason: item.reason ?? '',
      log: item.log ?? [],
      autoDeactivated: item.auto_deactivated ?? undefined,
      fixDetail: item.fix_detail ?? undefined,
    })),
  }
}

export async function recoverPackages(record: PrinterRecord): Promise<RecoverResult> {
  return parseRecoverResult(await doRequest(record, 'POST', '/packages/recover', undefined, undefined, LONG_OP_TIMEOUT_MS))
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

export async function uninstallBatch(record: PrinterRecord, pluginIds: string[], cascade: boolean): Promise<RecoverResult> {
  const body = Buffer.from(JSON.stringify({ plugin_ids: pluginIds, cascade }))
  const text = await doRequest(record, 'POST', '/packages/uninstall-batch', body, 'application/json', LONG_OP_TIMEOUT_MS)

  return parseRecoverResult(text)
}

// Post several .b3 packages to a batch route (update-batch or install-batch), which applies them all
// and restarts the affected services once. The two routes share the exact multipart shape; only the
// daemon-side semantics differ (install checks conflicts and reports an install), so this is one poster.
async function postBatchPackages(record: PrinterRecord, route: string, packages: BatchUpdatePackage[], onUploadProgress?: UploadProgressFn): Promise<RecoverResult> {
  const boundary = `----B3Boundary${Date.now()}`
  const varsById: Record<string, Record<string, string>> = {}
  packages.forEach((pkg) => {
    if (pkg.vars && Object.keys(pkg.vars).length > 0) varsById[pkg.pluginId] = pkg.vars
  })
  const body = buildBatchMultipart(boundary, packages, varsById)
  const text = await doRequest(record, 'POST', route, body, `multipart/form-data; boundary=${boundary}`, LONG_OP_TIMEOUT_MS, onUploadProgress)

  return parseRecoverResult(text)
}

export function updateBatchPackages(record: PrinterRecord, packages: BatchUpdatePackage[], onUploadProgress?: UploadProgressFn): Promise<RecoverResult> {
  return postBatchPackages(record, '/packages/update-batch', packages, onUploadProgress)
}

export function installBatchPackages(record: PrinterRecord, packages: BatchUpdatePackage[], onUploadProgress?: UploadProgressFn): Promise<RecoverResult> {
  return postBatchPackages(record, '/packages/install-batch', packages, onUploadProgress)
}
