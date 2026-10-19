// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { Plugin } from '../../../data/types'
import type { ScopeChoice } from '../../../data/plugin-vars'
import { seedFieldScopes } from '../../../data/plugin-vars'
import { useI18n } from '../../../i18n/context'
import { gatedInstallSpecs, pluginsNeedingConfig, capturedConfigFields, unambiguousCapturedValues } from './batch-install'
import type { BatchInstallContext, CapturedPluginValues } from './batch-install'

export interface CollectionInstall {
  // The missing members with required fields, so BatchConfigModal should show. Null when no
  // capture is pending.
  configPlugins: Plugin[] | null
  // The capture screen's per-field scope choices, hint-seeded when the capture opens and persisted
  // only at confirm (a cancelled capture saves nothing, values and scopes alike).
  configScopes: Record<string, ScopeChoice>
  setConfigScope: (fieldKey: string, choice: ScopeChoice) => void
  installMembers: (missing: Plugin[]) => void
  cancelConfig: () => void
  confirmConfig: (captured: CapturedPluginValues) => void
}

// "Install all" for a collection: install the not-yet-installed members in ONE batch (the daemon's
// update_batch => a single service restart, which is the multi-restart display-brick safety for free).
// It reuses the exact batch-install builders; a member that still needs a required value is captured
// first via the shared BatchConfigModal, identical to the multi-select batch flow. The collection is
// never an installed entity here - only its members are installed.
export function useCollectionInstall(deps: BatchInstallContext): CollectionInstall {
  const [pendingMembers, setPendingMembers] = useState<Plugin[] | null>(null)
  const [configScopes, setConfigScopes] = useState<Record<string, ScopeChoice>>({})
  const { t } = useI18n()

  function runInstall(members: Plugin[], captured: CapturedPluginValues = {}) {
    if (!deps.printerId || !deps.onInstallSelected) return
    const memberIds = members.map((member) => member.id)
    const specs = gatedInstallSpecs(t, memberIds, deps, captured)
    if (specs.length === 0) return

    deps.onInstallSelected(deps.printerId, specs)
  }

  function installMembers(missing: Plugin[]) {
    const needingConfig = pluginsNeedingConfig(missing)
    if (needingConfig.length === 0) {
      runInstall(missing)

      return
    }
    setConfigScopes(seedFieldScopes(capturedConfigFields(needingConfig), deps.scopeFor))
    setPendingMembers(missing)
  }

  function confirmConfig(captured: CapturedPluginValues) {
    const needingConfig = pendingMembers ? pluginsNeedingConfig(pendingMembers) : []
    const uniqueValues = unambiguousCapturedValues(captured)
    deps.onSaveVars?.({ values: uniqueValues, fields: capturedConfigFields(needingConfig).filter((field) => field.key in uniqueValues), scopeChoices: configScopes })
    if (pendingMembers) runInstall(pendingMembers, captured)
    setPendingMembers(null)
  }

  return {
    configPlugins: pendingMembers ? pluginsNeedingConfig(pendingMembers) : null,
    configScopes,
    setConfigScope: (fieldKey, choice) => setConfigScopes((current) => ({ ...current, [fieldKey]: choice })),
    installMembers,
    cancelConfig: () => setPendingMembers(null),
    confirmConfig,
  }
}
