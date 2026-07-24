import type { PrinterRecord } from '../printers'
import type { CapabilitiesResult, DaemonStatusResult, PluginConfigResult } from '@bespok3d/contract'
import { doRequest, DaemonHttpError } from './transport'

export interface SymlinkIssue {
  kind: 'missing' | 'not_a_symlink' | 'wrong_target'
  link_path: string
  expected_target?: string
  actual_target?: string
}

export interface PluginDrift {
  plugin_id: string
  symlink_issues: SymlinkIssue[]
}

export interface SelfCheckResult {
  ok: boolean
  drift: PluginDrift[]
}

export async function fetchDaemonStatus(record: PrinterRecord, timeoutMs?: number): Promise<DaemonStatusResult> {
  const text = await doRequest(record, 'GET', '/status', undefined, undefined, timeoutMs)

  return JSON.parse(text) as DaemonStatusResult
}

// The user vars the daemon persisted for an installed plugin (its user_vars.json), the tier-1 truth
// for the installed Config tab. A 404 means "no live value to vouch for": either the plugin dir is
// unknown or the daemon predates 0.12.12-dev (no route), so both degrade to null, not an error.
export async function fetchPluginConfig(record: PrinterRecord, pluginId: string, timeoutMs?: number): Promise<Record<string, string> | null> {
  try {
    const text = await doRequest(record, 'GET', `/plugins/${pluginId}/config`, undefined, undefined, timeoutMs)

    return (JSON.parse(text) as PluginConfigResult).vars
  } catch (error) {
    if (error instanceof DaemonHttpError && error.statusCode === 404) return null
    throw error
  }
}

export async function fetchCapabilities(record: PrinterRecord, timeoutMs?: number): Promise<CapabilitiesResult> {
  const text = await doRequest(record, 'GET', '/capabilities', undefined, undefined, timeoutMs)

  return JSON.parse(text) as CapabilitiesResult
}

export async function fetchSelfCheck(record: PrinterRecord, timeoutMs?: number): Promise<SelfCheckResult> {
  const text = await doRequest(record, 'GET', '/selfcheck', undefined, undefined, timeoutMs)

  return JSON.parse(text) as SelfCheckResult
}
