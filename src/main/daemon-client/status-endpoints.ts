// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
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

// A printer-level problem as the daemon words it: what is wrong, which thing it is wrong about, and
// the plugin it belongs to when it belongs to one.
export interface PrinterProblemWire {
  kind: string
  detail: string
  plugin_id: string | null
}

// A daemon that predates the printer-level check answers with `ok` and `drift` only, so both new
// lists are optional and an absent one reads as "nothing reported", never as "unknown".
export interface SelfCheckResult {
  ok?: boolean
  // Whether bespok3d is switched off ON THE PRINTER: its config includes are gone and its plugins are
  // unlinked because someone asked for that, not because anything broke. The app kept this in its own
  // records, so a printer switched off from another machine (or found already off) looked untouched.
  // A daemon too old to answer it omits the key, which reads as "on", the state that printer is in.
  switched_off?: boolean
  problems?: PrinterProblemWire[]
  drift?: PluginDrift[]
  // Machine tokens the printer says require a power cycle to clear (e.g. "display-pipe-wedged").
  // Absent or empty reads as "no reboot needed"; a daemon too old to answer omits the key, which
  // must read the same way, never as "unknown".
  reboot_required?: string[]
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
