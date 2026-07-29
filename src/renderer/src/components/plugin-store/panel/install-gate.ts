// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TFunction } from '../../../i18n'
import { blockedActionsSummary } from './blocked-actions'

// Why the Install button is disabled, in the 3-tier shape the rest of the app uses: a plain-language
// brief, a deeper detail, and an optional in-place action that takes the user to the fix. Exactly one
// reason is reported (highest-priority first) so the user is never left guessing at a dark button.
export interface InstallBlock {
  brief: string
  detail: string
  action?: 'configure'
}

export interface InstallBlockInput {
  printerId?: string
  configReady: boolean
  missingFields: string[]
  portError?: string | null
  conflicts: string[]
  printActive: boolean
  blockedActions: string[]
}

export function installBlockReason(t: TFunction, input: InstallBlockInput): InstallBlock | null {
  if (input.printActive) {
    const services = blockedActionsSummary(t, input.blockedActions)

    return { brief: t('store.block.print.brief'), detail: t('store.block.print.detail', { services }) }
  }
  if (!input.printerId) {
    return { brief: t('store.block.no_printer.brief'), detail: t('store.block.no_printer.detail') }
  }
  if (input.conflicts.length > 0) {
    const plugins = input.conflicts.join(', ')

    return { brief: t('store.block.conflicts.brief', { plugins }), detail: t('store.block.conflicts.detail', { plugins }) }
  }
  if (!input.configReady) {
    const fields = input.missingFields.join(', ')

    return { brief: t('store.block.config.brief'), detail: t('store.block.config.detail', { fields }), action: 'configure' }
  }
  if (input.portError) {
    return { brief: input.portError, detail: t('store.block.port.detail') }
  }

  return null
}
