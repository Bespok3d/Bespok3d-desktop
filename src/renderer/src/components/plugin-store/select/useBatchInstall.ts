import { useState } from 'react'
import type { Plugin } from '../../../data/types'
import type { ScopeChoice } from '../../../data/plugin-vars'
import { seedFieldScopes } from '../../../data/plugin-vars'
import { useI18n } from '../../../i18n/context'
import { splitByBatchGate } from '../batch-gate'
import { useSelectMode } from './useSelectMode'
import { installablePlugins, pluginsNeedingConfig, gatedInstallSpecs, capturedConfigFields } from './batch-install'
import type { BatchInstallContext } from './batch-install'

interface BatchInstallDeps extends BatchInstallContext {
  deactivatedIds: string[]
}

export interface BatchInstall {
  active: boolean
  selectedIds: string[]
  installableIds: string[]
  // Non-null while the config-capture screen is open, holding the selected plugins that need a value.
  configPlugins: Plugin[] | null
  // The capture screen's per-field scope choices: seeded from the manifest hints when the screen
  // opens, flipped in the modal, and persisted only when the capture is confirmed (a cancelled
  // batch saves nothing, values and scopes alike).
  configScopes: Record<string, ScopeChoice>
  setConfigScope: (fieldKey: string, choice: ScopeChoice) => void
  enter: () => void
  exit: () => void
  toggle: (pluginId: string) => void
  clear: () => void
  begin: () => void
  cancelConfig: () => void
  confirmConfig: (captured: Record<string, string>) => void
}

// The multi-select-and-install flow as one hook: track the selection, and on "Install selected" either
// open the config-capture screen (when a picked plugin still needs a value) or run the batch directly.
// The batch itself rides the daemon's update_batch, so the whole set restarts services only once.
export function useBatchInstall(deps: BatchInstallDeps): BatchInstall {
  const [configPlugins, setConfigPlugins] = useState<Plugin[] | null>(null)
  const [configScopes, setConfigScopes] = useState<Record<string, ScopeChoice>>({})
  const select = useSelectMode(() => setConfigPlugins(null))
  const { t } = useI18n()
  // Only what a single install would accept right now can be picked, so the batch cannot offer the
  // user a plugin the plugin panel would have refused.
  const installableIds = splitByBatchGate(t, installablePlugins(deps.catalogPlugins, deps.installedIds, deps.deactivatedIds), deps)
    .eligible.map((plugin) => plugin.id)

  function run(varsMap: Record<string, string>) {
    const specs = gatedInstallSpecs(t, select.selectedIds, { ...deps, savedVars: varsMap })
    if (deps.printerId && deps.onInstallSelected && specs.length > 0) {
      deps.onInstallSelected(deps.printerId, specs)
    }
    select.exit()
  }
  function begin() {
    const selected = deps.catalogPlugins.filter((plugin) => select.selectedIds.includes(plugin.id))
    const needing = pluginsNeedingConfig(selected, deps.savedVars)
    if (needing.length > 0) {
      setConfigPlugins(needing)
      setConfigScopes(seedFieldScopes(capturedConfigFields(needing), undefined))

      return
    }
    run(deps.savedVars)
  }
  function setConfigScope(fieldKey: string, choice: ScopeChoice) {
    setConfigScopes((current) => ({ ...current, [fieldKey]: choice }))
  }
  function confirmConfig(captured: Record<string, string>) {
    deps.onSaveVars?.({ values: captured, fields: capturedConfigFields(configPlugins ?? []), scopeChoices: configScopes })
    run({ ...deps.savedVars, ...captured })
  }

  return {
    active: select.active, selectedIds: select.selectedIds, installableIds, configPlugins, configScopes, setConfigScope,
    enter: select.enter, exit: select.exit, toggle: select.toggle, clear: select.clear,
    begin, cancelConfig: () => setConfigPlugins(null), confirmConfig,
  }
}
