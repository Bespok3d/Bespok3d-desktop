import { useState } from 'react'
import type { Plugin } from '../../../data/types'
import type { ScopeChoice, ScopeFlipHandler } from '../../../data/plugin-vars'
import { useI18n } from '../../../i18n/context'
import { useAsyncResource } from '../../common/hooks/useAsyncResource'
import { PluginConfigSection } from './config-section'
import { configTruth } from './config-truth'

export { FieldInput } from './field-input'
export { PluginConfigSection } from './config-section'
export { ScopeControl } from './scope-control'
export { initialConfigValues, configComplete, missingRequiredFields } from './values'

interface InstalledConfigProps {
  plugin: Plugin
  printerId?: string
  printerSelected?: boolean
  // Tier 2 of the truth ladder, read from the printer record: what this computer last sent and when.
  appliedVars?: Record<string, string>
  appliedVarsAt?: string
  // Per-field scope choices (panel-owned state) and their change handler, for the edit-mode control.
  scopes?: Record<string, ScopeChoice>
  onScopeChange?: ScopeFlipHandler
  otherUiPorts: number[]
  onApplied: (values: Record<string, string>) => void
  onMakePrimary?: () => void
}

// The installed Config tab: displays what the printer actually runs, never the app-global defaults
// map (which is what this computer would send NEXT, not what was applied). Reads the daemon's
// persisted vars as tier 1; a same-session apply immediately becomes the freshest tier-2 record
// while the live value is re-read.
function InstalledConfigArea({ plugin, printerId, printerSelected, appliedVars, appliedVarsAt, scopes, onScopeChange, otherUiPorts, onApplied, onMakePrimary }: InstalledConfigProps) {
  const { t } = useI18n()
  const pluginId = plugin.id
  const [sessionApplied, setSessionApplied] = useState<{ values: Record<string, string>; at: string } | null>(null)
  const liveConfig = useAsyncResource(
    () => (printerId ? window.b3d.store.pluginConfig(printerId, pluginId) : Promise.resolve(null)),
    [printerId, pluginId],
  )
  if (liveConfig.loading) {
    return (
      <div className="panel-config-section">
        <h3>{t('store.config_required')}</h3>
        <p className="config-truth-note">{t('store.config_loading')}</p>
      </div>
    )
  }
  const truth = configTruth(liveConfig.value, sessionApplied?.values ?? appliedVars, sessionApplied?.at ?? appliedVarsAt)

  return (
    <PluginConfigSection
      fields={plugin.config ?? []}
      current={truth.values}
      tier={truth.tier}
      appliedAt={truth.appliedAt}
      installed
      printerId={printerId}
      printerSelected={printerSelected}
      pluginId={pluginId}
      scopes={scopes}
      onScopeChange={onScopeChange}
      otherUiPorts={otherUiPorts}
      onApplied={(values) => {
        setSessionApplied({ values, at: new Date().toISOString() })
        liveConfig.reload()
        onApplied(values)
      }}
      onMakePrimary={onMakePrimary}
    />
  )
}

// The plugin detail panel's Config tab body: the pre-install editable form feeding the install vars,
// the truth-ladder view once installed, or nothing when the plugin declares no config.
export function PanelConfigArea({ plugin, installed, printerId, printerSelected, appliedVars, appliedVarsAt, multiVars, scopes, onScopeChange, otherUiPorts, onMultiVars, onApplied, onMakePrimary }: {
  plugin: Plugin; installed: boolean; printerId?: string; printerSelected?: boolean
  appliedVars?: Record<string, string>; appliedVarsAt?: string
  multiVars: Record<string, string>
  scopes?: Record<string, ScopeChoice>
  onScopeChange?: ScopeFlipHandler
  otherUiPorts: number[]
  onMultiVars: (values: Record<string, string>) => void
  onApplied: (values: Record<string, string>) => void; onMakePrimary?: () => void
}) {
  const multiFields = plugin.config
  if (!multiFields) return null
  if (installed) {
    return (
      <InstalledConfigArea
        plugin={plugin} printerId={printerId} printerSelected={printerSelected} appliedVars={appliedVars} appliedVarsAt={appliedVarsAt}
        scopes={scopes} onScopeChange={onScopeChange}
        otherUiPorts={otherUiPorts} onApplied={onApplied} onMakePrimary={onMakePrimary}
      />
    )
  }

  return (
    <PluginConfigSection
      fields={multiFields}
      current={multiVars}
      installed={false}
      printerId={printerId}
      printerSelected={printerSelected}
      pluginId={plugin.id}
      scopes={scopes}
      onScopeChange={onScopeChange}
      otherUiPorts={otherUiPorts}
      onValuesChange={onMultiVars}
      onApplied={onApplied}
      onMakePrimary={onMakePrimary}
    />
  )
}
