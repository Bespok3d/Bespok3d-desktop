// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TFunction } from '../../../i18n'
import type { PortProblem } from '../../../data/ports'
import { blockedActionsSummary } from './blocked-actions'

// Why the Install button is disabled, in the 3-tier shape the rest of the app uses: a plain-language
// brief, a deeper detail, and an optional in-place action that takes the user to the fix. Exactly one
// reason is reported (highest-priority first) so the user is never left guessing at a dark button.
export interface InstallBlock {
  brief: string
  detail: string
  action?: 'configure'
}

// The two versions in play when this printer's daemon is older than the plugin demands. Present only
// when both numbers are known: a daemon that did not report its version is not a refusal, it is a
// question the app could not ask, and the panel warns about that instead of blocking on it.
export interface UnmetDaemonFloor {
  required: string
  running: string
}

export interface InstallBlockInput {
  printerId?: string
  configReady: boolean
  missingFields: string[]
  portProblem?: PortProblem | null
  addressError?: string | null
  conflicts: string[]
  printActive: boolean
  blockedActions: string[]
  daemonFloorUnmet?: UnmetDaemonFloor | null
}

export function installBlockReason(t: TFunction, input: InstallBlockInput): InstallBlock | null {
  if (input.printActive) {
    const services = blockedActionsSummary(t, input.blockedActions)

    return { brief: t('store.block.print.brief'), detail: t('store.block.print.detail', { services }) }
  }
  if (!input.printerId) {
    return { brief: t('store.block.no_printer.brief'), detail: t('store.block.no_printer.detail') }
  }
  if (input.daemonFloorUnmet) {
    const versions = { ...input.daemonFloorUnmet }

    return { brief: t('store.block.daemon_too_old.brief', versions), detail: t('store.block.daemon_too_old.detail', versions) }
  }
  if (input.conflicts.length > 0) {
    const plugins = input.conflicts.join(', ')

    return { brief: t('store.block.conflicts.brief', { plugins }), detail: t('store.block.conflicts.detail', { plugins }) }
  }
  if (!input.configReady) {
    const fields = input.missingFields.join(', ')

    return { brief: t('store.block.config.brief'), detail: t('store.block.config.detail', { fields }), action: 'configure' }
  }
  if (input.portProblem) {
    return { brief: t(input.portProblem.key, input.portProblem.params), detail: t('store.block.port.detail') }
  }
  if (input.addressError) {
    return { brief: t(input.addressError), detail: t('store.block.address.detail'), action: 'configure' }
  }

  return null
}
