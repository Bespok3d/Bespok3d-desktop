// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin, PluginConfigField } from '../../data/types'
import type { UpdateAllPlan } from '../plugin-store/migrations'
import { configComplete } from '../plugin-store/config/values'
import type { CapturedPluginValues } from '../plugin-store/select/batch-install'
import { varsToSend } from '../../../../main/store/vars-to-send'
import type { PrinterVars } from '../../../../main/store/vars-to-send'

type PluginValues = Record<string, string>

// The values each plugin of an update batch goes to the printer with, by plugin id.
export type KnownPluginValues = Record<string, PluginValues>

// What the printer answered for each plugin it was asked about, by plugin id.
export type PrinterPluginValues = Record<string, PrinterVars>

function lacksRequiredValue(plugin: Plugin, values: PluginValues): boolean {
  return !configComplete(plugin.config ?? [], values)
}

function hasNoSourcePick(spec: PluginUpdateSpec): boolean {
  return !spec.sourceUrl && !spec.channel
}

// The same variant main sends for this spec (catalogVariantOrNone): with no source and no channel it
// is the plugin's winner, whose settings the plugin itself carries.
function configOfSpec(plugin: Plugin, spec: PluginUpdateSpec): PluginConfigField[] | undefined {
  if (hasNoSourcePick(spec)) return plugin.config
  const picked = plugin.sources.find((source) => (!spec.sourceUrl || source.registryUrl === spec.sourceUrl) && (!spec.channel || source.channel === spec.channel))

  return picked ? picked.config : plugin.config
}

function lastSpecOf(specs: PluginUpdateSpec[], pluginId: string): PluginUpdateSpec | undefined {
  return specs.filter((spec) => spec.pluginId === pluginId).at(-1)
}

// Each batch plugin once, with the settings of the build the batch installs.
export function batchPlugins(specs: PluginUpdateSpec[], catalogPlugins: Plugin[]): Plugin[] {
  return catalogPlugins.flatMap((plugin) => {
    const spec = lastSpecOf(specs, plugin.id)

    return spec ? [{ ...plugin, config: configOfSpec(plugin, spec) }] : []
  })
}

// Only these need the printer's answer: every other plugin's required values are in the batch itself.
export function pluginsToAskThePrinter(specs: PluginUpdateSpec[], plugins: Plugin[]): string[] {
  return plugins.filter((plugin) => lacksRequiredValue(plugin, lastSpecOf(specs, plugin.id)?.vars ?? {})).map((plugin) => plugin.id)
}

// The batch fills each spec the way main does before it goes out (withPrinterVars). No default is
// counted: main drops a required setting's default by the manifest's requires list, which the catalog
// does not carry here, so a required field with only a default is asked for rather than guessed. A
// plugin the printer was not asked about is read as holding nothing, so its own values stand.
export function knownPluginValues(specs: PluginUpdateSpec[], plugins: Plugin[], printerValues: PrinterPluginValues): KnownPluginValues {
  return Object.fromEntries(plugins.map((plugin) => [
    plugin.id,
    varsToSend(lastSpecOf(specs, plugin.id)?.vars, printerValues[plugin.id] ?? {}, {}),
  ]))
}

// The batch plugins the printer would refuse for a required setting nobody has given a value to.
export function pluginsMissingValues(plugins: Plugin[], known: KnownPluginValues): Plugin[] {
  return plugins.filter((plugin) => lacksRequiredValue(plugin, known[plugin.id] ?? {}))
}

function specWithCapturedValues(spec: PluginUpdateSpec, captured: CapturedPluginValues): PluginUpdateSpec {
  const capturedValues = captured[spec.pluginId]

  return capturedValues ? { ...spec, vars: { ...spec.vars, ...capturedValues } } : spec
}

export function planWithCapturedValues(plan: UpdateAllPlan, captured: CapturedPluginValues): UpdateAllPlan {
  return {
    updates: plan.updates.map((spec) => specWithCapturedValues(spec, captured)),
    migrations: plan.migrations.map((migration) => ({
      ...migration,
      arrivingSpecs: migration.arrivingSpecs.map((spec) => specWithCapturedValues(spec, captured)),
    })),
  }
}
