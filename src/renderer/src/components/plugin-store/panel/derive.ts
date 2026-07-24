import type { Plugin, PluginSource, ReleaseChannel } from '../../../data/types'
import type { TFunction } from '../../../i18n'
import { effectiveVariant } from '../../../data/channels'
import { isInstalledVariant } from './tabs/sources'
import { configComplete, missingRequiredFields } from '../config/config-form'
import { installBlockReason, type InstallBlock } from './install-gate'

// An orphan is installed on the printer but offered by no catalog source (its sideloaded .b3 was
// removed while kept on the printer, with no bundled/online alternative): only uninstall remains.
export function isOrphan(plugin: Plugin): boolean {
  return plugin.sources.length === 0
}

// A sideloaded package (the Create tool's output takes the same path) is unverified-local: trust 'any'
// + a disk source. Its docs are not build-bundled, so they are read from the local store at runtime.
export function isSideloaded(plugin: Plugin): boolean {
  return plugin.sources.some((source) => source.local && source.trust === 'any')
}

// "Switch version" vs "Reinstall": selecting the exact variant already on the printer (same source +
// channel) is a reinstall, NOT a switch, even when the catalog source.version has drifted from the
// device version (the installed row shows the device version, so the button must agree with it). Any
// other source/channel is a switch; for an unrecorded-source install, fall back to a version compare.
export function isSwitchingVariant(installed: boolean, selected: PluginSource | undefined, installedSource?: string, installedChannel?: ReleaseChannel, installedVersion?: string): boolean {
  if (!installed || !selected) return false
  if (isInstalledVariant(selected, installedSource, installedChannel)) return false
  if (!installedSource) return !!installedVersion && selected.version !== installedVersion

  return true
}

// The exact variant on the printer: the recorded source AND channel when both are known, falling back
// to source-only (older records carry no channel) so the installed row is still preselected.
function installedVariantOf(plugin: Plugin, installedSource?: string, installedChannel?: ReleaseChannel): PluginSource | undefined {
  if (!installedSource) return undefined
  const exact = plugin.sources.find((source) => source.registryUrl === installedSource && source.channel === installedChannel)

  return exact ?? plugin.sources.find((source) => source.registryUrl === installedSource)
}

// The Versions tab's initial selection: the installed variant, else what the channel ceiling installs,
// else the published (non-local) source, else the first listed.
export function defaultSelectedVariant(plugin: Plugin, ceiling: ReleaseChannel, disabledChannels: ReleaseChannel[], installedSource?: string, installedChannel?: ReleaseChannel): PluginSource | undefined {
  return installedVariantOf(plugin, installedSource, installedChannel)
    ?? effectiveVariant(plugin, ceiling, disabledChannels)
    ?? plugin.sources.find((source) => !source.local)
    ?? plugin.sources[0]
}

// Derives whether install is allowed and, when it is not, the single reason to show. Kept out of the
// component body so the panel reads as a flat list of derived values.
export function installGate(t: TFunction, plugin: Plugin, state: {
  multiVars: Record<string, string>; printerId?: string
  conflicts: string[]; portError: string | null; printActive: boolean; blockedActions: string[]
}): { block: InstallBlock | null; canInstall: boolean } {
  const multiFields = plugin.config
  const configReady = multiFields ? configComplete(multiFields, state.multiVars) : true
  const missingFields = multiFields ? missingRequiredFields(multiFields, state.multiVars) : []
  const canInstall = !!state.printerId && configReady && state.conflicts.length === 0 && !state.portError && !state.printActive
  const block = installBlockReason(t, { ...state, configReady, missingFields })

  return { block, canInstall }
}
