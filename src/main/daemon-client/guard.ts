// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { DaemonHttpError } from './client'
import { malformedPackageMessage } from '../store/malformed-package'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// The user-facing name of a blocked-action token (ADR-0037: the daemon and jinni emit machine
// tokens, the client names them). Klipper and Moonraker are product names; the display is described
// plainly. An unknown token forward-degrades to itself, so a newer daemon never shows a blank reason.
const BLOCKED_ACTION_LABELS: Record<string, string> = {
  'restart-klipper': 'Klipper',
  'restart-moonraker': 'Moonraker',
  'restart-display': 'the screen',
}

function blockedActionLabel(token: string): string {
  return BLOCKED_ACTION_LABELS[token] ?? token
}

// The two halves that have to fit together on a managed printer, as the user knows them. An unknown
// side degrades to its own token, so a newer daemon that names a third half still tells him something.
const BEHIND_SIDE_LABELS: Record<string, string> = {
  jinni: 'adapter (jinni)',
  daemon: 'daemon',
}

// A pair refusal is about the PRINTER, not the package: the daemon and the adapter on it do not fit
// together, so no package would have installed. The daemon names the side that is behind and both
// versions; the sentence telling him which half to update is written here.
function incompatiblePairMessage(side: string, required: string, running: string): string {
  const behind = BEHIND_SIDE_LABELS[side] ?? side

  return `This printer's ${behind} is ${running}, older than the ${required} this daemon works with. ` +
    `Nothing was installed. Update the ${behind} from the printer's page, then try again.`
}

// A daemon 4xx carries a reason for the install/uninstall error zone: a structured 409 (a printer
// whose two halves do not fit together, a print-blocked refusal carrying action TOKENS, a conflict,
// dependents, an unmet requirement, or a malformed-package integrity refusal), or a plain-string
// detail. Surface a readable message instead
// of the raw "daemon 4xx: {json}". The proactive UI lock is localized in the renderer; this
// hard-refusal path mirrors the existing English strings here. An integrity refusal is different: it
// carries a machine reason token plus the offending paths, encoded for the renderer to name and list.
// Returns null for any other error so it propagates.
export function daemonGuardMessage(error: unknown): string | null {
  if (!(error instanceof DaemonHttpError)) return null
  if (typeof error.detail === 'string' && error.detail.trim()) return error.detail
  if (!isRecord(error.detail)) return null
  const detail = error.detail
  if (detail.error === 'incompatible_pair' && typeof detail.side === 'string') {
    return incompatiblePairMessage(detail.side, String(detail.required), String(detail.running))
  }
  if (detail.error === 'blocked' && Array.isArray(detail.blocked_actions)) {
    const services = detail.blocked_actions.map((token) => blockedActionLabel(String(token))).join(', ')

    return `The printer is busy: this would restart ${services}, interrupting the print. Try again when it is idle.`
  }
  if (detail.error === 'conflict' && Array.isArray(detail.conflicts)) {
    return `Conflicts with installed plugin(s): ${detail.conflicts.join(', ')}`
  }
  if (detail.error === 'dependents' && Array.isArray(detail.dependents)) {
    return `Still needed by: ${detail.dependents.join(', ')}`
  }
  if (detail.error === 'requirement' && Array.isArray(detail.missing)) {
    return `Requires a plugin that provides: ${detail.missing.join(', ')}`
  }
  if (detail.error === 'integrity' && typeof detail.reason === 'string') {
    const paths = Array.isArray(detail.paths) ? detail.paths.map(String) : []

    return malformedPackageMessage(detail.reason, paths)
  }

  return null
}
