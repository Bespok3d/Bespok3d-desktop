import type { Plugin, ReleaseChannel } from '../../data/types'
import { resolveMissingDeps } from '../../data/deps'
import { isNewerVersion } from '../../utils/version'
import { availableVersion, ALLOW_ALL_CHANNELS } from '../../data/channels'
import type { CeilingResolver } from '../../data/channels'

// Plugins whose available build (on the channel the user is on) is strictly newer than what is
// installed (a real update). An installed version ahead of the catalog is NOT an update (no downgrade
// prompts). The ceiling defaults to allow-all for callers that do not thread the real ceiling.
export function updatablePlugins(plugins: Plugin[], installedVersions: Record<string, string>, ceilingFor: CeilingResolver = ALLOW_ALL_CHANNELS, disabledChannels: ReleaseChannel[] = []): Plugin[] {
  return plugins.filter((plugin) =>
    Boolean(installedVersions[plugin.id]) && isNewerVersion(availableVersion(plugin, ceilingFor(plugin.id), disabledChannels), installedVersions[plugin.id]))
}

// The config values an install/update should carry: each declared field's saved value or its default,
// dropping blanks so a plugin without config sends nothing.
export function pluginInstallVars(plugin: Plugin, savedVars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    (plugin.config ?? [])
      .map((field) => [field.key, savedVars[field.key] ?? field.default ?? ''])
      .filter(([, value]) => value !== ''),
  )
}

// One update spec per updatable plugin: its saved config vars plus the deps a new version may need.
export function buildUpdateSpecs(
  plugins: Plugin[],
  installedIds: string[],
  installedVersions: Record<string, string>,
  savedVars: Record<string, string>,
  ceilingFor: CeilingResolver = ALLOW_ALL_CHANNELS,
  disabledChannels: ReleaseChannel[] = [],
): PluginUpdateSpec[] {
  return updatablePlugins(plugins, installedVersions, ceilingFor, disabledChannels).map((plugin) => ({
    pluginId: plugin.id,
    vars: pluginInstallVars(plugin, savedVars),
    depIds: resolveMissingDeps(plugins, plugin.id, installedIds),
  }))
}
