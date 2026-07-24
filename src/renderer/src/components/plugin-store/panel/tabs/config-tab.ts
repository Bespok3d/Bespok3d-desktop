import { useState } from 'react'
import type { Plugin, PluginConfigField } from '../../../../data/types'
import type { PluginVarsSave, ScopeChoice } from '../../../../data/plugin-vars'
import { seedFieldScopes } from '../../../../data/plugin-vars'
import { initialConfigValues } from '../../config/config-form'
import { httpPortField, uiPortFields, suggestedPort, uiPorts, makePrimaryPlan } from '../../../../data/ports'

export function seedUiPort(
  plugin: Plugin,
  plugins: Plugin[],
  installed: boolean,
  installedIds: string[],
  savedVars: Record<string, string> | undefined,
): Record<string, string> {
  const base = initialConfigValues(plugin.config ?? [], savedVars)
  const portField = httpPortField(plugin)
  if (installed || !portField || savedVars?.[portField.key]) return base

  return { ...base, [portField.key]: String(suggestedPort(plugins, installedIds, savedVars ?? {}, plugin.id)) }
}

export function uiPortControls(input: {
  plugin: Plugin; plugins: Plugin[]; installedIds: string[]
  savedVars?: Record<string, string>; printerId?: string
  onSaveVars?: (save: PluginVarsSave) => void
  setMultiVars: (next: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  const { plugin, plugins, installedIds, savedVars, printerId, onSaveVars, setMultiVars } = input
  const ports = uiPorts(plugins, installedIds, savedVars ?? {})
  const otherUiPorts = Object.entries(ports).filter(([id]) => id !== plugin.id).map(([, port]) => port)
  async function makePrimary() {
    const plan = makePrimaryPlan(plugins, installedIds, savedVars ?? {}, plugin.id)
    const portField = httpPortField(plugin)
    if (portField) setMultiVars((prev) => ({ ...prev, [portField.key]: plan.savedPatch[portField.key] }))
    onSaveVars?.({ values: plan.savedPatch, fields: uiPortFields(plugins) })
    if (!printerId) return
    await Promise.all(
      plan.reconfigure.map((entry) => window.b3d.store.reconfigure(printerId, entry.pluginId, entry.vars)),
    )
  }

  return { otherUiPorts, makePrimary }
}

// The Config tab's state, bundled for the panel: the install-form values, the per-field scope
// choices (seeded from the derived scope, flipped by the scope control), the port controls, and
// the two scope-aware persistence moments (an applied reconfigure, a completed install).
export function usePanelConfigState(input: {
  plugin: Plugin; plugins: Plugin[]; installed: boolean; installedIds: string[]
  savedVars: Record<string, string> | undefined; printerId?: string
  scopeFor?: (field: PluginConfigField) => ScopeChoice
  onSaveVars?: (save: PluginVarsSave) => void
}) {
  const { plugin, plugins, installed, installedIds, savedVars, printerId, scopeFor, onSaveVars } = input
  const [multiVars, setMultiVars] = useState(() => seedUiPort(plugin, plugins, installed, installedIds, savedVars))
  const [multiScopes, setMultiScopes] = useState(() => seedFieldScopes(plugin.config ?? [], scopeFor))
  const { otherUiPorts, makePrimary } = uiPortControls({ plugin, plugins, installedIds, savedVars, printerId, onSaveVars, setMultiVars })
  // A flip is a direct action on the preference store, not draft state: it persists the field's
  // shown value under the chosen scope immediately (a value-less flip can never reach Apply, and
  // panel state evaporates on unmount). It never talks to the printer; reconfigure stays the sender.
  function setFieldScope(fieldKey: string, choice: ScopeChoice, shownValue: string) {
    setMultiScopes((current) => ({ ...current, [fieldKey]: choice }))
    const flippedField = (plugin.config ?? []).find((field) => field.key === fieldKey)
    if (flippedField) onSaveVars?.({ values: { [fieldKey]: shownValue }, fields: [flippedField], scopeChoices: { [fieldKey]: choice } })
  }
  function saveConfigVars(values: Record<string, string>) {
    onSaveVars?.({ values, fields: plugin.config ?? [], scopeChoices: multiScopes })
  }
  function persistInstallVars() {
    if (plugin.config) saveConfigVars(multiVars)
  }

  return { multiVars, setMultiVars, multiScopes, setFieldScope, otherUiPorts, makePrimary, saveConfigVars, persistInstallVars }
}
